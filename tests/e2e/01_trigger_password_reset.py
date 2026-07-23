"""Abre la reja de /admin con ADMIN_ACCESS_KEY (leída del .env real, nunca
hardcodeada aquí) y dispara "olvidé mi contraseña" para la cuenta existente,
igual que lo haría un usuario real desde el navegador. Guarda la cookie de la
reja en storage_state para que los siguientes scripts no tengan que volver a
pasar la clave por URL."""
from playwright.sync_api import sync_playwright
from env_reader import load_env, BASE_URL, STORAGE_STATE_PATH

env = load_env()
admin_key = env["ADMIN_ACCESS_KEY"]

with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context()
    page = context.new_page()

    # Primera visita con la clave en la URL -> pone la cookie de un año (ver
    # require_admin_gate() en src/auth.php) para no repetirla en cada página.
    page.goto(f"{BASE_URL}/admin/login.php?key={admin_key}")
    page.wait_for_load_state("networkidle")
    assert "login-card" in page.content(), "La reja no dejó pasar a login.php con la clave correcta"
    print("OK: reja de /admin superada, login.php visible")

    page.goto(f"{BASE_URL}/admin/forgot-password.php")
    page.fill("#identifier", "mpolo01")
    page.click("button.login-submit")
    page.wait_for_load_state("networkidle")

    body = page.content()
    if "Te enviamos instrucciones" in body:
        print("OK: solicitud de reset enviada, Brevo debería mandar el correo real")
    else:
        print("ADVERTENCIA: no se vio el mensaje de éxito esperado")
        print(body[:2000])

    context.storage_state(path=STORAGE_STATE_PATH)
    browser.close()
