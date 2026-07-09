/**
 * Botón de "ojo" para mostrar/ocultar contraseña en los formularios de
 * login, alta de cuenta y restablecimiento. Un solo listener delegado en
 * document, así funciona sin importar cuántos campos de este tipo haya en
 * la página — no depende de recorrer el DOM al cargar.
 */
(function () {
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-password-toggle]');
    if (!btn) return;

    var input = btn.parentElement.querySelector('input');
    if (!input) return;

    var isRevealed = input.type === 'text';
    input.type = isRevealed ? 'password' : 'text';
    btn.classList.toggle('is-visible', !isRevealed);
    btn.setAttribute('aria-label', isRevealed ? 'Mostrar contraseña' : 'Ocultar contraseña');
  });
})();
