/**
 * Switch de tema para las páginas de autenticación (login, primer arranque,
 * recuperar/cambiar contraseña, verificación de correo/en dos pasos) — antes
 * estas páginas solo tenían el script anti-flash (theme_antiflash_script()
 * en helpers.php, que resuelve el data-theme correcto antes de pintar según
 * la última elección guardada o el sistema operativo) pero ningún botón
 * visible para cambiarlo a mano ahí mismo.
 *
 * Independiente de admin-sections.js (el switch del dashboard) porque estas
 * páginas no cargan admin-state.js/MPVAdmin — solo necesitan leer y
 * alternar la misma clave "mpv_theme" en localStorage que ya comparten el
 * sitio público y el dashboard, para que la elección hecha aquí también se
 * respete en cualquiera de los dos. Mismo fundido (fade) de 200ms que usa el
 * resto del sitio al alternar tema/idioma (ver theme.js, i18n.js,
 * admin-sections.js).
 */
(function () {
  var STORAGE_KEY = 'mpv_theme';
  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FADE_MS = 200;
  // 1000ms — debe coincidir con --duration-theme en admin-base.css. Mientras
  // dura, .theme-transitioning hace que TODO lo que cambia de color por el
  // tema se anime a esta misma velocidad (ver el mismo mecanismo en
  // theme.js/admin-sections.js) — incluido el fondo con degradado de
  // .login-screen (--auth-bg) y el propio botón de tema, que sin esto fundía
  // a su ritmo corto de hover (--duration-fast) mientras el fondo de la
  // pantalla, sin transición propia, cambiaba de golpe.
  var THEME_TRANSITION_MS = 1000;
  var themeTransitionTimer = null;

  function currentMode() {
    return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function fadeSwap(el, mutate, animate) {
    if (!el) return;
    if (!animate || reduceMotion) { mutate(); return; }
    var prevTransition = el.style.transition;
    el.style.transition = 'opacity ' + FADE_MS + 'ms ease';
    el.style.opacity = '0';
    setTimeout(function () {
      mutate();
      el.style.opacity = '1';
      setTimeout(function () {
        el.style.transition = prevTransition;
      }, FADE_MS);
    }, FADE_MS);
  }

  function update(animate) {
    var mode = currentMode();
    var label = mode === 'light' ? 'Claro' : 'Oscuro';
    document.querySelectorAll('[data-theme-label]').forEach(function (el) {
      fadeSwap(el, function () { el.textContent = label; }, animate);
    });
    if (!window.MPVIcons) return;
    document.querySelectorAll('[data-theme-icon]').forEach(function (el) {
      fadeSwap(el, function () {
        el.innerHTML = mode === 'light' ? window.MPVIcons.sun : window.MPVIcons.moon;
      }, animate);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    update(false);
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var next = currentMode() === 'dark' ? 'light' : 'dark';
        if (!reduceMotion) {
          root.classList.add('theme-transitioning');
          clearTimeout(themeTransitionTimer);
          themeTransitionTimer = setTimeout(function () {
            root.classList.remove('theme-transitioning');
          }, THEME_TRANSITION_MS);
        }
        root.setAttribute('data-theme', next);
        try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
        update(true);
      });
    });
  });
})();
