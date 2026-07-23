"""Smoke test del dashboard ya logueado (reusa storage_state): recorre las 7
secciones, revisa que no haya errores de JS/consola (clave para validar que
los cambios de accesibilidad en admin-forms.js/admin-combo.js/
admin-datepicker.js/admin-sortable.js no rompieron nada), y valida los
atributos ARIA agregados (aria-selected en las tabs, role=heading, etc.)."""
from playwright.sync_api import sync_playwright
from env_reader import BASE_URL, STORAGE_STATE_PATH

SECTIONS = ["hero", "projects", "skills", "experience", "education", "contact", "cv"]

errors = []

with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(storage_state=STORAGE_STATE_PATH)
    page = context.new_page()
    page.on("pageerror", lambda exc: errors.append(f"pageerror: {exc}"))
    page.on("console", lambda msg: errors.append(f"console.{msg.type}: {msg.text}") if msg.type == "error" else None)

    page.goto(f"{BASE_URL}/admin/index.php")
    page.wait_for_load_state("networkidle")

    if "login.php" in page.url:
        print("FALLO: no quedó logueado (redirigió a login.php) — storage_state venció o es inválido")
        browser.close()
        raise SystemExit(1)

    print("OK: dashboard cargado, URL=" + page.url)

    for section in SECTIONS:
        page.click(f'[data-section-btn="{section}"]')
        page.wait_for_timeout(150)
        btn = page.locator(f'[data-section-btn="{section}"]')
        selected = btn.get_attribute("aria-selected")
        panel = page.locator(f'#panel-{section}')
        hidden = panel.get_attribute("hidden")
        ok = selected == "true" and hidden is None
        print(f"  seccion={section} aria-selected={selected} panel-hidden={hidden} -> {'OK' if ok else 'FALLO'}")

    # role=heading en el título de sección activo
    heading = page.locator('[data-section-title]')
    print("  role del titulo de seccion:", heading.get_attribute("role"), "aria-level:", heading.get_attribute("aria-level"))

    if errors:
        print("\nERRORES DE CONSOLA/JS DETECTADOS:")
        for e in errors:
            print("  " + e)
    else:
        print("\nOK: cero errores de consola/JS durante toda la navegacion")

    browser.close()
