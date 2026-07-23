"""Recaptura las screenshots del README: las actuales tienen duplicados
byte-a-byte (ver auditoría — 09/10 idénticas, 11-16 todas idénticas) a pesar
de estar rotuladas como secciones distintas. Genera un set nuevo, real, uno
por sección."""
import os
from playwright.sync_api import sync_playwright
from env_reader import load_env, BASE_URL, STORAGE_STATE_PATH

SHOTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "screenshots"))
env = load_env()
admin_key = env["ADMIN_ACCESS_KEY"]

with sync_playwright() as p:
    browser = p.chromium.launch()

    # --- Login screen (sin sesion) ---
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    page.goto(f"{BASE_URL}/admin/login.php?key={admin_key}")
    page.wait_for_load_state("networkidle")
    page.screenshot(path=os.path.join(SHOTS_DIR, "01-login.png"))
    print("01-login.png OK")
    ctx.close()

    # --- Dashboard (logueado) ---
    ctx2 = browser.new_context(storage_state=STORAGE_STATE_PATH, viewport={"width": 1440, "height": 900})
    page2 = ctx2.new_page()
    page2.goto(f"{BASE_URL}/admin/index.php")
    page2.wait_for_load_state("networkidle")
    assert "login.php" not in page2.url, "no logueado para las capturas del dashboard"

    dashboard_shots = [
        ("hero", "03-dashboard-hero-preview.png"),
        ("projects", "04-dashboard-proyectos.png"),
        ("experience", "05-dashboard-experiencia.png"),
        ("skills", "06-dashboard-habilidades.png"),
        ("education", "07-dashboard-educacion.png"),
        ("cv", "08-dashboard-cv.png"),
        ("contact", "09-dashboard-contacto.png"),
    ]
    for section, filename in dashboard_shots:
        page2.click(f'[data-section-btn="{section}"]')
        page2.wait_for_timeout(400)
        page2.screenshot(path=os.path.join(SHOTS_DIR, filename))
        print(filename, "OK")

    # Toast de guardado real
    page2.click('[data-save]')
    page2.wait_for_selector('[data-toast]:not([hidden])', timeout=5000)
    page2.wait_for_timeout(150)
    page2.screenshot(path=os.path.join(SHOTS_DIR, "10-dashboard-toast-guardado.png"))
    print("10-dashboard-toast-guardado.png OK")
    page2.wait_for_timeout(600)
    ctx2.close()

    # --- Sitio publico, por seccion ---
    ctx3 = browser.new_context(viewport={"width": 1440, "height": 900})
    page3 = ctx3.new_page()
    page3.goto(f"{BASE_URL}/")
    page3.wait_for_load_state("networkidle")

    public_shots = [
        ("#top", "11-portafolio-hero.png"),
        ("#projects", "12-portafolio-proyectos.png"),
        ("#skills", "13-portafolio-habilidades.png"),
        ("#experience", "14-portafolio-experiencia.png"),
        ("#education", "15-portafolio-educacion.png"),
        ("#contact", "16-portafolio-contacto.png"),
    ]
    for selector, filename in public_shots:
        page3.locator(selector).scroll_into_view_if_needed()
        page3.wait_for_timeout(400)  # deja terminar scroll-reveal.js
        page3.screenshot(path=os.path.join(SHOTS_DIR, filename))
        print(filename, "OK")

    # Tema claro
    theme = page3.evaluate("document.documentElement.getAttribute('data-theme')")
    if theme != "light":
        page3.click("[data-theme-toggle]")
        page3.wait_for_timeout(300)
    page3.locator("#top").scroll_into_view_if_needed()
    page3.wait_for_timeout(200)
    page3.screenshot(path=os.path.join(SHOTS_DIR, "17-portafolio-tema-claro.png"))
    print("17-portafolio-tema-claro.png OK")

    # CV
    page3.goto(f"{BASE_URL}/?cv=1")
    page3.wait_for_load_state("networkidle")
    page3.screenshot(path=os.path.join(SHOTS_DIR, "18-portafolio-cv.png"))
    print("18-portafolio-cv.png OK")

    ctx3.close()
    browser.close()
