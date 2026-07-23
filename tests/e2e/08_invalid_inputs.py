"""QA adversarial: contraseña incorrecta, usuario inexistente (mensajes
específicos — comportamiento intencional, NO se debe "arreglar"), formulario
vacío, string con intento de XSS guardado y releído (debe salir escapado,
nunca ejecutarse), y logout real."""
from playwright.sync_api import sync_playwright, expect
from env_reader import load_env, BASE_URL, STORAGE_STATE_PATH

env = load_env()
admin_key = env["ADMIN_ACCESS_KEY"]
xss_probe = '<script>window.__xss_fired = true;</script>"><img src=x onerror="window.__xss_fired=true">'

with sync_playwright() as p:
    browser = p.chromium.launch()

    # --- 1. Contraseña incorrecta ---
    context = browser.new_context()
    page = context.new_page()
    page.goto(f"{BASE_URL}/admin/login.php?key={admin_key}")
    page.fill("#username", "mpolo01")
    page.fill("#password", "esta-contrasena-esta-mal-a-proposito")
    page.click("button.login-submit")
    page.wait_for_load_state("networkidle")
    err = page.locator(".login-error")
    print("password incorrecto -> mensaje:", err.inner_text() if err.count() else "(sin mensaje, FALLO)")

    # --- 2. Usuario inexistente (mensaje especifico es intencional, NO tocar) ---
    page.goto(f"{BASE_URL}/admin/login.php")
    page.fill("#username", "usuario-que-no-existe-qa")
    page.fill("#password", "cualquiera")
    page.click("button.login-submit")
    page.wait_for_load_state("networkidle")
    err2 = page.locator(".login-error")
    print("usuario inexistente -> mensaje:", err2.inner_text() if err2.count() else "(sin mensaje, FALLO)")

    # --- 3. Formulario vacio (validacion HTML5 required, no deberia ni hacer POST) ---
    page.goto(f"{BASE_URL}/admin/login.php")
    page.click("button.login-submit")
    page.wait_for_timeout(300)
    still_on_login = "login.php" in page.url and page.locator("#username").count() > 0
    print("formulario vacio -> se quedo en login.php (validacion required):", "OK" if still_on_login else "FALLO")
    context.close()

    # --- 4. XSS en un campo de texto real (hero.name), guardar, releer ---
    context2 = browser.new_context(storage_state=STORAGE_STATE_PATH)
    page2 = context2.new_page()
    page2.on("dialog", lambda d: d.dismiss())  # si alert() llegara a dispararse, no debe bloquear el script
    page2.goto(f"{BASE_URL}/admin/index.php")
    page2.wait_for_load_state("networkidle")
    assert "login.php" not in page2.url, "no logueado para prueba XSS"

    original_name = page2.locator("#f-hero-name").input_value()
    page2.fill("#f-hero-name", xss_probe)
    page2.evaluate("document.querySelector('#f-hero-name').dispatchEvent(new Event('input', {bubbles:true}))")
    page2.click('[data-save]')
    expect(page2.locator('[data-toast]')).to_be_visible(timeout=5000)
    page2.wait_for_timeout(600)

    fired = page2.evaluate("window.__xss_fired === true")
    print("XSS en hero.name durante el guardado (antes de recargar):", "FALLO, SE EJECUTO" if fired else "OK, no se ejecuto")

    # Revertir DE INMEDIATO antes de seguir probando
    page2.fill("#f-hero-name", original_name)
    page2.evaluate("document.querySelector('#f-hero-name').dispatchEvent(new Event('input', {bubbles:true}))")
    page2.click('[data-save]')
    expect(page2.locator('[data-toast]')).to_be_visible(timeout=5000)
    page2.wait_for_timeout(600)

    # Releer el sitio publico (donde el nombre se imprime real) para confirmar que se escapa
    page3 = context2.new_page()
    page3.on("dialog", lambda d: d.dismiss())
    page3.goto(f"{BASE_URL}/")
    page3.wait_for_load_state("networkidle")
    fired_public = page3.evaluate("window.__xss_fired === true")
    hero_html = page3.evaluate("document.querySelector('.hero__name, [data-hero-name], h1')?.outerHTML || ''")
    print("XSS revisado tambien en el sitio publico:", "FALLO, SE EJECUTO" if fired_public else "OK, no se ejecuto")

    print("nombre restaurado a:", page2.locator("#f-hero-name").input_value() if page2.locator('#f-hero-name').count() else "?")
    # Logout se prueba aparte (09_logout.py) porque revoca el dispositivo de
    # confianza (ver clear_trusted_device_cookie() en logout.php) — correrlo
    # aquí obligaría a repetir contraseña+OTP para cualquier prueba
    # autenticada posterior (p. ej. las capturas de pantalla del README).

    browser.close()
