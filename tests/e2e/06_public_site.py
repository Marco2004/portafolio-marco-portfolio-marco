"""Recorre el sitio público real: carga, cambia tema/idioma, abre y cierra el
lightbox de imágenes, y revisa que no haya scroll horizontal ni errores de
consola en 3 anchos de viewport (teléfono chico, teléfono mediano, tablet)."""
from playwright.sync_api import sync_playwright, expect
from env_reader import BASE_URL

VIEWPORTS = [("320x568 (telefono chico)", 320, 568), ("390x844 (telefono mediano)", 390, 844), ("768x1024 (tablet vertical)", 768, 1024)]

errors = []

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.on("pageerror", lambda exc: errors.append(f"pageerror: {exc}"))
    page.on("console", lambda msg: errors.append(f"console.error: {msg.text}") if msg.type == "error" else None)

    page.goto(f"{BASE_URL}/")
    page.wait_for_load_state("networkidle")
    print("titulo:", page.title())

    # Tema
    theme_before = page.evaluate("document.documentElement.getAttribute('data-theme')")
    page.click("[data-theme-toggle]")
    page.wait_for_timeout(150)
    theme_after = page.evaluate("document.documentElement.getAttribute('data-theme')")
    print(f"tema: {theme_before} -> {theme_after} -> {'OK' if theme_before != theme_after else 'FALLO'}")

    # Idioma (si existe el boton)
    lang_btn = page.locator("[data-lang-toggle]")
    if lang_btn.count() > 0:
        lang_before = page.evaluate("document.documentElement.lang")
        lang_btn.first.click()
        page.wait_for_timeout(150)
        lang_after = page.evaluate("document.documentElement.lang")
        print(f"idioma: {lang_before} -> {lang_after} -> {'OK' if lang_before != lang_after else 'FALLO'}")

    # Lightbox: click en la primera imagen de proyecto clicable
    lightbox_trigger = page.locator('img.flagship__image, img.project-card__image').first
    if lightbox_trigger.count() > 0:
        lightbox_trigger.scroll_into_view_if_needed()
        lightbox_trigger.click()
        page.wait_for_timeout(400)
        modal = page.locator('[data-image-lightbox]')
        visible = modal.first.is_visible() if modal.count() > 0 else False
        print("lightbox abre al hacer click:", "OK" if visible else "FALLO (no se encontro modal visible)")
        if visible:
            page.keyboard.press("Escape")
            page.wait_for_timeout(200)
            still_visible = modal.first.is_visible()
            print("lightbox cierra con Escape:", "OK" if not still_visible else "FALLO")
    else:
        print("lightbox: no se encontro ninguna imagen de proyecto clicable, se omite")

    # Responsive: sin scroll horizontal en ningun viewport
    for label, w, h in VIEWPORTS:
        page.set_viewport_size({"width": w, "height": h})
        page.wait_for_timeout(200)
        scroll_w = page.evaluate("document.documentElement.scrollWidth")
        client_w = page.evaluate("document.documentElement.clientWidth")
        overflow = scroll_w - client_w
        print(f"viewport {label}: scrollWidth={scroll_w} clientWidth={client_w} -> {'OK, sin overflow' if overflow <= 1 else 'FALLO, overflow de ' + str(overflow) + 'px'}")

    if errors:
        print("\nERRORES DE CONSOLA/JS DETECTADOS:")
        for e in errors:
            print("  " + e)
    else:
        print("\nOK: cero errores de consola/JS")

    browser.close()
