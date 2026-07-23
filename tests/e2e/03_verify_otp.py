"""Completa el login con el código OTP de 6 dígitos (pasado por la variable
de entorno MPV_OTP_CODE, nunca hardcodeado). Marca "recordar este
dispositivo" para que las siguientes corridas de pruebas ya no pidan OTP."""
import os
import sys
from playwright.sync_api import sync_playwright
from env_reader import BASE_URL, STORAGE_STATE_PATH

code = os.environ.get("MPV_OTP_CODE")
if not code:
    print("Falta MPV_OTP_CODE en el entorno.")
    sys.exit(1)

with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(storage_state=STORAGE_STATE_PATH)
    page = context.new_page()

    page.goto(f"{BASE_URL}/admin/verify.php")
    page.fill("#code", code)
    page.check('input[name="remember"]')
    page.click("button.login-submit")
    page.wait_for_load_state("networkidle")

    url = page.url
    if "index.php" in url:
        print("OK: login completo, dashboard cargado en " + url)
        context.storage_state(path=STORAGE_STATE_PATH)
    else:
        print("Resultado inesperado, URL=" + url)
        print(page.content()[:1500])

    browser.close()
