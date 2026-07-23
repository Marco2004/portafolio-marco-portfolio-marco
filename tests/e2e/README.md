# Pruebas E2E (Playwright + Python)

Scripts independientes (no requieren pytest) que abren un Chromium real
contra una instancia local en marcha (XAMPP) y ejercen los flujos reales del
sitio: login con OTP, recuperación de contraseña, CRUD del dashboard,
accesibilidad (teclado), responsive, entradas inválidas/XSS, el menú
hamburguesa del nav público, logout y capturas de pantalla para el README.

## Requisitos

- XAMPP con Apache y MySQL corriendo, proyecto servido en
  `http://localhost/portafolio-marco/`.
- Python 3 con `playwright` instalado (`pip install playwright`) y los
  navegadores descargados (`python -m playwright install chromium`).
- `.env` configurado (al menos `DB_*` y `ADMIN_ACCESS_KEY`) — ver
  `.env.example` en la raíz del proyecto.

## Autenticación: cuenta real, con OTP real por correo

Estas pruebas se autentican siempre con la cuenta real de administrador, vía
la UI y el flujo completo de 2FA por correo — no existe (ni debe existir) un
atajo que cree cuentas de administrador saltándose el gate/OTP: un par de
scripts así (`qa_setup_test_account.php`/`qa_teardown_test_account.php`)
vivieron aquí hasta que una auditoría de seguridad encontró que, al no tener
`tests/` el mismo `.htaccess` de "Require all denied" que ya protege `src/`,
`database/` e `i18n/`, quedaban ejecutables por HTTP sin ninguna
autenticación — cualquiera que encontrara la URL podía crear una cuenta de
administrador completa. Se borraron (no eran necesarios para el
funcionamiento del proyecto) y `tests/` ahora tiene su propio `.htaccess` de
"Require all denied" como capa extra.

```
python 01_trigger_password_reset.py     # dispara un reset real por correo
# revisa el correo, pega el link/token en reset-password.php a mano si hace falta
MPV_ADMIN_PASS='...' python 02_login.py # password real por variable de entorno, nunca en el código
# revisa el correo por el código OTP de 6 dígitos
MPV_OTP_CODE='123456' python 03_verify_otp.py
```

Las contraseñas/códigos **nunca** se escriben en los archivos `.py` — se
pasan por variable de entorno en el momento de correr el script, y
`env_reader.py` lee `ADMIN_ACCESS_KEY` directo del `.env` real del proyecto
para abrir la reja de `/admin` sin hardcodearla. La sesión se guarda en
`.admin_storage_state.json` (ignorado por git), así que no hace falta
repetir contraseña + OTP en cada corrida mientras esa sesión siga vigente.

## El resto de las pruebas

Una vez logueado, corré lo que haga falta:

```
python 04_dashboard_smoke.py            # navega las 7 secciones, revisa errores de consola
python 05_dashboard_a11y_and_save.py    # reordenar con teclado, combo con Enter, guardado real
python 06_public_site.py                # tema/idioma, lightbox, responsive
python 07_admin_responsive.py           # mini-row apiladas, objetivos táctiles, drawer móvil
python 08_invalid_inputs.py             # password incorrecto, XSS, formulario vacío
python 09_screenshots.py                # regenera screenshots/*.png para el README
python 10_logout.py                     # requiere sesión activa — revoca "recordar dispositivo"
python 11_nav_menu.py                   # menú hamburguesa del nav público (abrir/cerrar/Escape/responsive)
```

## Notas importantes descubiertas al correrlas

- **`05_dashboard_a11y_and_save.py`** modifica contenido real temporalmente
  (agrega un dato de prueba a "Ficha rápida", lo quita, y solo entonces
  guarda) — tiene una compuerta de seguridad que aborta antes de guardar si
  el contenido de prueba no se quitó correctamente primero.
- **`10_logout.py`** solo funciona con una sesión ya autenticada porque
  revoca "recordar este dispositivo" — por eso se corre al final, después
  de todo lo que necesita seguir logueado (incluidas las screenshots).
  Después de correrlo hay que repetir contraseña + OTP para volver a entrar.
- Encontró un bug real de la reja de `/admin` (cookie con `path` fijo que
  no coincidía al servir el proyecto desde una subcarpeta) — corregido en
  `admin_gate_cookie_path()`, `src/auth.php`.
- Encontró un bug real en el menú hamburguesa del nav (`11_nav_menu.py`):
  abrir el menú reemplaza el ícono del botón (cambia su `innerHTML`), lo
  que desconectaba del DOM el `<svg>` exacto que originó el clic — el
  listener de "cerrar al hacer clic afuera" usaba `e.target.closest(...)`,
  que sobre un nodo ya desconectado siempre da `false` — corregido usando
  `e.composedPath()` en `public/assets/js/nav-menu.js`.
- Encontró que MySQL y PHP pueden tener zonas horarias distintas
  configuradas en el mismo servidor (`NOW()` de MySQL vs `date()` de PHP) —
  la aplicación nunca se ve afectada (todas las comparaciones de expiración
  usan el reloj de PHP consistentemente, nunca `NOW()` de SQL), pero
  cualquier limpieza manual por SQL directo debe tenerlo en cuenta.
