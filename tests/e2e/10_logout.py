"""Prueba logout real: revoca sesión + dispositivo confiable (ver logout.php),
y confirma que volver a /admin/index.php después ya no funciona. Se corre al
final porque revoca el "recordar este dispositivo" que las pruebas
anteriores dependían de tener activo.

Nota de la auditoría: la primera corrida de este script encontró un bug real
— tras el logout, /admin/index.php no redirigía a login.php, sino que
devolvía 404 en blanco. Causa: require_admin_gate() en src/auth.php ponía el
cookie de la reja con path fijo "/admin/", que solo coincide si el proyecto
vive en la raíz del dominio. En este XAMPP local el proyecto vive en
"/portafolio-marco/", así que ese cookie nunca se reenviaba de vuelta — se
enmascaraba mientras la sesión siguiera viva ($_SESSION['admin_gate_ok']),
pero en cuanto el logout destruye la sesión, la reja ya no tenía forma de
volver a confirmarse sin repetir la clave por URL. Corregido calculando la
ruta del cookie a partir de la propia request (admin_gate_cookie_path() en
src/auth.php), igual que ya hacían forgot-password.php/setup.php/
verify-email.php para sus enlaces absolutos. Verificado a nivel HTTP
(sin volver a pedir OTP) que tras el fix login.php responde 200 solo con el
cookie de la reja después de un logout real."""
from playwright.sync_api import sync_playwright
from env_reader import BASE_URL, STORAGE_STATE_PATH

with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(storage_state=STORAGE_STATE_PATH)
    page = context.new_page()

    page.goto(f"{BASE_URL}/admin/index.php")
    page.wait_for_load_state("networkidle")
    assert "login.php" not in page.url, "no logueado antes de probar logout"

    page.click('a[href="logout.php"]')
    page.wait_for_load_state("networkidle")
    print("logout -> URL final:", page.url, "->", "OK" if "login.php" in page.url else "FALLO")

    page.goto(f"{BASE_URL}/admin/index.php")
    page.wait_for_load_state("networkidle")
    print("tras logout, /admin/index.php redirige a:", page.url, "->", "OK, sesion cerrada de verdad" if "login.php" in page.url else "FALLO, la sesion seguia activa")

    # Ir "atras" en el navegador tampoco debe mostrar el dashboard cacheado
    page.go_back()
    page.wait_for_load_state("networkidle")
    print("boton atras del navegador tras logout:", page.url, "->", "OK" if "login.php" in page.url else "FALLO, mostro contenido cacheado")

    browser.close()
