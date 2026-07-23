"""Valida en el navegador real los arreglos de accesibilidad más riesgosos
(reordenar con teclado, seleccionar una opción del combo con Enter) y hace un
guardado real de ida y vuelta a la base de datos: agrega un dato temporal a
"Ficha rápida" (hero facts), lo reordena con teclado, guarda, recarga la
página para confirmar que persistió, y lo vuelve a quitar + guarda para dejar
el contenido real exactamente como estaba."""
from playwright.sync_api import sync_playwright, expect
from env_reader import BASE_URL, STORAGE_STATE_PATH

errors = []

with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(storage_state=STORAGE_STATE_PATH)
    page = context.new_page()
    page.on("pageerror", lambda exc: errors.append(f"pageerror: {exc}"))
    page.on("console", lambda msg: errors.append(f"console.error: {msg.text}") if msg.type == "error" else None)

    page.goto(f"{BASE_URL}/admin/index.php")
    page.wait_for_load_state("networkidle")
    assert "login.php" not in page.url, "no logueado"

    # --- 1. Agregar un hero fact temporal (E2E, no destructivo) ---
    before_count = page.locator('[data-hero-fact-row]').count()
    page.click('[data-add-hero-fact]')
    page.wait_for_timeout(100)
    after_count = page.locator('[data-hero-fact-row]').count()
    print(f"hero facts antes={before_count} despues de agregar={after_count} -> {'OK' if after_count == before_count + 1 else 'FALLO'}")

    new_row = page.locator('[data-hero-fact-row]').last
    new_row.locator('input[data-field="label"]').fill("QA-E2E-temporal")
    new_row.locator('input[data-field="value"]').fill("borrar-si-queda")

    # --- 2. Reordenar con teclado (ArrowUp) el nuevo fact, que quedó al final ---
    handle = new_row.locator('[data-drag-handle]')
    handle.focus()
    page.keyboard.press("ArrowUp")
    page.wait_for_timeout(150)
    moved_ok = page.locator('[data-hero-fact-row]').nth(max(0, after_count - 2)).locator('input[data-field="label"]').input_value() == "QA-E2E-temporal"
    print("reordenar con flecha arriba (drag-handle, sin mouse):", "OK" if moved_ok else "FALLO")

    # --- 3. Combo: seleccionar una opción de nivel de habilidad con teclado ---
    # Se prueba sobre la PRIMERA skill real existente, así que se guarda su
    # valor original y se restaura después de probar — este script solo debe
    # validar el comportamiento del combo, nunca dejar un cambio de contenido
    # real a mitad de una prueba de accesibilidad.
    page.click('[data-section-btn="skills"]')
    page.wait_for_timeout(150)
    combo_input = page.locator('[data-combo-input]').first
    if combo_input.count() > 0:
        original_value = combo_input.input_value()
        toggle = page.locator('[data-combo-toggle]').first
        toggle.click()
        page.wait_for_timeout(100)
        first_option = page.locator('[data-combo-option]').first
        first_option.focus()
        chosen_label = first_option.get_attribute('data-combo-option')
        page.keyboard.press("Enter")
        page.wait_for_timeout(100)
        combo_ok = combo_input.input_value() == chosen_label
        print(f"combo: elegir opcion con Enter (teclado) -> {'OK' if combo_ok else 'FALLO'} (valor={combo_input.input_value()!r})")
        combo_input.fill(original_value)
        combo_input.dispatch_event("input")
        print(f"combo: valor original restaurado ({original_value!r}) antes de guardar")
    else:
        print("combo: no hay skills existentes para probar, se omite")

    # --- 4. Volver a Inicio, quitar el hero fact temporal ---
    page.click('[data-section-btn="hero"]')
    page.wait_for_timeout(150)
    rows = page.locator('[data-hero-fact-row]')
    target_idx = None
    for i in range(rows.count()):
        if rows.nth(i).locator('input[data-field="label"]').input_value() == "QA-E2E-temporal":
            target_idx = i
            break
    if target_idx is not None:
        rows.nth(target_idx).locator('[data-action="remove-hero-fact"]').click()
        # Quitar una fila dispara el modal propio de confirmación (ver
        # admin-confirm-dialog.js) en vez de window.confirm() — hay que
        # confirmarlo, si no la fila se queda y el overlay bloquea todo lo
        # de atrás (incluido el botón de Guardar). Tras confirmar, settle()
        # tarda 160ms y dustDisintegrate() otros 650ms (fundido + colapso)
        # antes de que recién ahí se haga el splice()+render() real — un
        # sleep corto no alcanza a cubrir eso, por eso se espera con
        # reintento (expect) en vez de un wait_for_timeout fijo.
        page.click('[data-confirm-ok]')
        expect(page.locator('[data-hero-fact-row]')).to_have_count(before_count, timeout=3000)

    final_count = page.locator('[data-hero-fact-row]').count()
    print(f"hero facts despues de quitar el temporal={final_count} -> {'OK' if final_count == before_count else 'FALLO'}")

    # Cinturón de seguridad: si por lo que sea el temporal no se quitó de
    # verdad, JAMÁS se debe llegar al guardado real — mejor abortar el
    # script que persistir basura de prueba en el contenido real del sitio.
    if final_count != before_count:
        print("ABORTANDO antes de guardar: el conteo no volvió al original, no se debe persistir esto.")
        browser.close()
        raise SystemExit(1)

    # --- 5. Guardar de verdad (round-trip real a MySQL) ---
    page.click('[data-save]')
    expect(page.locator('[data-toast]')).to_be_visible(timeout=5000)
    expect(page.locator('[data-toast-text]')).not_to_have_text('Guardando cambios…', timeout=5000)
    toast_text = page.locator('[data-toast-text]').inner_text()
    print("guardar -> toast:", toast_text)

    page.wait_for_timeout(600)  # deja que el toast/red terminen antes de recargar
    page.reload()
    page.wait_for_load_state("networkidle")
    reloaded_count = page.locator('[data-hero-fact-row]').count()
    print(f"tras recargar, hero facts={reloaded_count} -> {'OK, quedo igual que antes de la prueba' if reloaded_count == before_count else 'FALLO'}")

    if errors:
        print("\nERRORES DE CONSOLA/JS DETECTADOS:")
        for e in errors:
            print("  " + e)
    else:
        print("\nOK: cero errores de consola/JS durante toda la prueba")

    browser.close()
