"""Verifica en un navegador real (no solo leyendo el CSS) que los arreglos de
responsive/touch-target del dashboard realmente se aplican a 375px: las
mini-row se apilan a una columna, los objetivos táctiles miden >=40px, y no
hay scroll horizontal en ninguna sección."""
from playwright.sync_api import sync_playwright
from env_reader import BASE_URL, STORAGE_STATE_PATH

with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(storage_state=STORAGE_STATE_PATH, viewport={"width": 375, "height": 812})
    page = context.new_page()

    page.goto(f"{BASE_URL}/admin/index.php")
    page.wait_for_load_state("networkidle")
    assert "login.php" not in page.url, "no logueado"

    # mini-row realmente se apila a 1 columna a 375px
    grid_cols = page.evaluate("""
        () => {
          const el = document.querySelector('.mini-row');
          if (!el) return null;
          return getComputedStyle(el).gridTemplateColumns;
        }
    """)
    print("mini-row grid-template-columns a 375px:", grid_cols, "-> ", "OK (una sola columna)" if grid_cols and len(grid_cols.split()) == 1 else "revisar")

    def check_touch_targets(section_label, selectors):
        sizes = page.evaluate("""
            (sels) => sels.map(sel => {
              const el = document.querySelector(sel + ':not([hidden])');
              if (!el) return [sel, null, null];
              const r = el.getBoundingClientRect();
              return [sel, Math.round(r.width), Math.round(r.height)];
            })
        """, selectors)
        for sel, w, h in sizes:
            if w is None or (w == 0 and h == 0):
                print(f"  ({section_label}) {sel}: no visible en esta seccion, se omite")
            else:
                ok = w >= 40 and h >= 40
                print(f"  ({section_label}) {sel}: {w}x{h}px -> {'OK' if ok else 'FALLO, por debajo de 40px'}")

    check_touch_targets("hero", ['.mini-remove', '.drag-handle', '.color-swatch__reset'])

    # A 375px la barra lateral es un drawer oculto (translateX(-100%)) hasta
    # que se abre con el botón hamburguesa — sin esto, clickear un
    # [data-section-btn] falla ("element is outside of the viewport"), que es
    # el comportamiento CORRECTO del drawer, no un bug.
    def open_drawer_and_go(section):
        page.click('[data-drawer-toggle]')
        page.wait_for_timeout(200)
        page.click(f'[data-section-btn="{section}"]')
        page.wait_for_timeout(200)

    open_drawer_and_go("projects")
    check_touch_targets("projects", ['.repeat-card__toggle', '.drag-handle'])

    open_drawer_and_go("skills")
    check_touch_targets("skills", ['.mini-remove', '.drag-handle', '.combo__toggle', '.combo__option-delete'])

    # Sin scroll horizontal en ninguna seccion
    for section in ["hero", "projects", "skills", "experience", "education", "contact", "cv"]:
        open_drawer_and_go(section)
        scroll_w = page.evaluate("document.documentElement.scrollWidth")
        client_w = page.evaluate("document.documentElement.clientWidth")
        overflow = scroll_w - client_w
        print(f"seccion {section}: overflow horizontal = {overflow}px -> {'OK' if overflow <= 1 else 'FALLO'}")

    browser.close()
