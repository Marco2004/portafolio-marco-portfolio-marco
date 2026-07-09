(function () {
  var FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

  document.addEventListener('DOMContentLoaded', function () {
    var overlay = document.querySelector('[data-cv-overlay]');
    if (!overlay) return;

    var closeBtn = overlay.querySelector('[data-cv-close]');
    var lastFocused = null;

    function focusableElements() {
      return Array.prototype.slice.call(overlay.querySelectorAll(FOCUSABLE_SELECTOR));
    }

    function open(e) {
      lastFocused = e && e.currentTarget instanceof HTMLElement ? e.currentTarget : document.activeElement;
      overlay.hidden = false;
      document.body.style.overflow = 'hidden';
      // La clase "cv-open" es lo que @media print usa (ver base.css) para
      // ocultar el resto del sitio e imprimir solo el CV — antes nada la
      // encendía, así que imprimir con el overlay abierto imprimía la página
      // completa por debajo en vez del CV.
      document.body.classList.add('cv-open');
      // Mueve el foco adentro del diálogo para que un lector de pantalla
      // anuncie su apertura y el teclado no se quede "atrás" del overlay.
      if (closeBtn) closeBtn.focus();
    }

    function close() {
      overlay.hidden = true;
      document.body.style.overflow = '';
      document.body.classList.remove('cv-open');
      // Devuelve el foco a quien abrió el CV (botón del nav o de contacto),
      // en vez de dejarlo perdido en el <body>.
      if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    }

    var printBtn = overlay.querySelector('[data-cv-print]');
    if (printBtn) printBtn.addEventListener('click', function () { window.print(); });

    // Enlazar directo a "?cv=1" (usado por el botón "Descargar CV" del
    // dashboard) abre el overlay solo, sin recargar de nuevo — el admin
    // sigue haciendo clic manual en "Imprimir / Guardar como PDF" adentro.
    if (new URLSearchParams(location.search).get('cv') === '1') {
      open();
    }

    document.querySelectorAll('[data-cv-open]').forEach(function (btn) {
      btn.addEventListener('click', open);
    });
    document.querySelectorAll('[data-cv-close]').forEach(function (btn) {
      btn.addEventListener('click', close);
    });

    document.addEventListener('keydown', function (ev) {
      if (overlay.hidden) return;

      if (ev.key === 'Escape') {
        close();
        return;
      }

      // Focus trap: el diálogo modal no debe dejar que Tab se escape hacia
      // el resto de la página mientras está abierto.
      if (ev.key === 'Tab') {
        var items = focusableElements();
        if (!items.length) return;
        var first = items[0];
        var last = items[items.length - 1];
        if (ev.shiftKey && document.activeElement === first) {
          ev.preventDefault();
          last.focus();
        } else if (!ev.shiftKey && document.activeElement === last) {
          ev.preventDefault();
          first.focus();
        }
      }
    });
  });
})();
