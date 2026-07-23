"""Login real vía la UI (usuario+contraseña) reusando la cookie de la reja
guardada por 01_trigger_password_reset.py. La contraseña se pasa por la
variable de entorno MPV_ADMIN_PASS (nunca hardcodeada ni escrita a disco) —
ver README de esta carpeta. Marca "recordar este dispositivo" para que las
pruebas siguientes no tengan que repetir el código OTP en cada corrida."""
import os
import sys
from playwright.sync_api import sync_playwright
from env_reader import BASE_URL, STORAGE_STATE_PATH

password = os.environ.get("MPV_ADMIN_PASS")
if not password:
    print("Falta MPV_ADMIN_PASS en el entorno.")
    sys.exit(1)

with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(storage_state=STORAGE_STATE_PATH)
    page = context.new_page()

    page.goto(f"{BASE_URL}/admin/login.php")
    page.fill("#username", "mpolo01")
    page.fill("#password", password)
    page.click("button.login-submit")
    page.wait_for_load_state("networkidle")

    url = page.url
    if url.endswith("verify.php") or "verify.php" in url:
        print("OK: contraseña correcta, pidió código OTP por correo (verify.php)")
        context.storage_state(path=STORAGE_STATE_PATH)
        print("PENDING_OTP")
    elif "index.php" in url:
        print("OK: login completo sin OTP (dispositivo ya confiable)")
        context.storage_state(path=STORAGE_STATE_PATH)
    else:
        print("Resultado inesperado, URL=" + url)
        body = page.content()
        print(body[:1500])

    browser.close()
