"""Prueba el nuevo menú hamburguesa del nav público: oculto en escritorio,
visible y funcional (abrir/cerrar, Escape, clic afuera, cerrar al elegir un
link) a 760px y menos (el CSS usa "@media (max-width: 760px)", inclusivo —
ver public/assets/css/responsive.css y public/assets/js/nav-menu.js), sin
overflow horizontal y sin errores de consola en ningún ancho."""
from playwright.sync_api import sync_playwright
from env_reader import BASE_URL

errors = []
VIEWPORTS_MOBILE = [320, 360, 375, 390, 480, 600, 759, 760]
VIEWPORTS_DESKTOP = [761, 768, 1024, 1440]

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    page.goto(f"{BASE_URL}/")
    page.wait_for_load_state("networkidle")

    for w in VIEWPORTS_MOBILE:
        page.set_viewport_size({"width": w, "height": 800})
        page.wait_for_timeout(150)
        toggle_visible = page.locator('[data-nav-menu-toggle]').is_visible()
        links_visible = page.locator('[data-nav-links]').is_visible()
        print(f"{w}px: hamburguesa visible={toggle_visible} links visibles (antes de abrir)={links_visible}", "-> OK" if toggle_visible and not links_visible else "-> FALLO")

    # A 375px: abrir, revisar aria-expanded + overflow, cerrar con Escape
    page.set_viewport_size({"width": 375, "height": 800})
    page.wait_for_timeout(150)
    toggle = page.locator('[data-nav-menu-toggle]')
    links = page.locator('[data-nav-links]')

    toggle.click()
    page.wait_for_timeout(300)
    print("tras abrir: aria-expanded=", toggle.get_attribute("aria-expanded"), "links visible=", links.is_visible())
    scroll_w = page.evaluate("document.documentElement.scrollWidth")
    client_w = page.evaluate("document.documentElement.clientWidth")
    print(f"overflow horizontal con menu abierto: {scroll_w - client_w}px ->", "OK" if scroll_w - client_w <= 1 else "FALLO")

    page.keyboard.press("Escape")
    page.wait_for_timeout(300)
    print("tras Escape: aria-expanded=", toggle.get_attribute("aria-expanded"), "links visible=", links.is_visible(), "foco en el boton=", page.evaluate("document.activeElement === document.querySelector('[data-nav-menu-toggle]')"))

    # Clic afuera cierra
    toggle.click()
    page.wait_for_timeout(300)
    page.mouse.click(10, 700)
    page.wait_for_timeout(300)
    print("tras clic afuera: links visible=", links.is_visible(), "-> OK" if not links.is_visible() else "-> FALLO")

    # Elegir un link cierra el menu y navega (ancla de scroll)
    toggle.click()
    page.wait_for_timeout(300)
    page.click('[data-nav-links] a[href="#projects"]')
    page.wait_for_timeout(400)
    print("tras elegir un link: links visible=", links.is_visible(), "url=", page.url, "-> OK" if not links.is_visible() and "#projects" in page.url else "-> FALLO")

    # Regresión: el logo/"Portafolio Web" (.nav__brand) también es un destino
    # de navegación (vuelve a #top) pero vive FUERA de [data-nav-links] (no se
    # colapsa, siempre visible) — un bug real dejaba el menú abierto flotando
    # encima del contenido al elegirlo con el menú abierto. Ver nav-menu.js.
    page.evaluate("window.scrollTo(0, 900)")
    page.wait_for_timeout(200)
    toggle.click()
    page.wait_for_timeout(300)
    page.click(".nav__brand")
    page.wait_for_timeout(400)
    print("tras elegir el logo (Inicio) con el menu abierto: links visible=", links.is_visible(), "scrollY=", page.evaluate("window.scrollY"), "-> OK" if not links.is_visible() else "-> FALLO, el menu se quedo abierto")

    # Botones de idioma/tema siguen funcionando dentro del menu movil
    page.set_viewport_size({"width": 375, "height": 800})
    toggle.click()
    page.wait_for_timeout(300)
    theme_before = page.evaluate("document.documentElement.getAttribute('data-theme')")
    page.click('[data-theme-toggle]')
    page.wait_for_timeout(200)
    theme_after = page.evaluate("document.documentElement.getAttribute('data-theme')")
    print(f"tema dentro del menu movil: {theme_before} -> {theme_after}", "-> OK" if theme_before != theme_after else "-> FALLO")

    # Escritorio/tablet: hamburguesa oculta, links siempre visibles, sin overflow
    for w in VIEWPORTS_DESKTOP:
        page.set_viewport_size({"width": w, "height": 900})
        page.wait_for_timeout(150)
        toggle_visible = page.locator('[data-nav-menu-toggle]').is_visible()
        links_visible = page.locator('[data-nav-links]').is_visible()
        scroll_w = page.evaluate("document.documentElement.scrollWidth")
        client_w = page.evaluate("document.documentElement.clientWidth")
        ok = not toggle_visible and links_visible and (scroll_w - client_w) <= 1
        print(f"{w}px: hamburguesa oculta={not toggle_visible} links siempre visibles={links_visible} overflow={scroll_w-client_w}px", "-> OK" if ok else "-> FALLO")

    if errors:
        print("\nERRORES DE CONSOLA/JS:")
        for e in errors:
            print("  " + e)
    else:
        print("\nOK: cero errores de consola/JS en toda la prueba")

    browser.close()
