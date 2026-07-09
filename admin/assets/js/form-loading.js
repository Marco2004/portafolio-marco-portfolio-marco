/**
 * Feedback de "procesando" para los formularios de autenticación (login,
 * setup, forgot/reset password, verificación) — estas páginas son POST +
 * recarga completa, no fetch/AJAX, así que un toast no tendría sentido (la
 * página cambia antes de que se pudiera ocultar): en vez de eso, el botón de
 * envío se deshabilita y muestra un spinner mientras la petición está en
 * vuelo, para dar feedback inmediato y evitar doble-envío por doble clic.
 */
(function () {
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    var btn = form.querySelector('button[type="submit"]');
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    btn.classList.add('is-loading');
  });
})();
