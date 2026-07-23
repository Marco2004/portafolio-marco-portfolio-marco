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
        root.setAttribute('data-theme', next);
        try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
        update(true);
      });
    });
  });
})();
