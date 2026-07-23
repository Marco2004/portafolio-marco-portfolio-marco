/**
 * Ventana emergente al hacer clic en la imagen de un proyecto (insignia o
 * tarjeta normal) — un solo overlay compartido en el HTML (ver
 * [data-image-lightbox] en public/index.php), reutilizado para cualquier
 * imagen en la que se haga clic. Mismo patrón de accesibilidad (Escape,
 * trampa de foco, bloquear el scroll de fondo, devolver el foco a quien lo
 * abrió) que ya usa public/assets/js/cv-overlay.js, para no inventar un
 * segundo mecanismo distinto en el mismo sitio.
 */
(function () {
  var FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

  document.addEventListener('DOMContentLoaded', function () {
    var overlay = document.querySelector('[data-image-lightbox]');
    if (!overlay) return;

    var img = overlay.querySelector('[data-image-lightbox-img]');
    var closeBtn = overlay.querySelector('[data-image-lightbox-close]');
    if (closeBtn && window.MPVIcons) closeBtn.innerHTML = window.MPVIcons.close;

    var lastFocused = null;

    function open(trigger) {
      lastFocused = trigger;
      img.src = trigger.currentSrc || trigger.src;
      img.alt = trigger.alt || '';
      overlay.hidden = false;
      // Reflow antes de agregar la clase que dispara la transición — si no,
      // al venir de hidden=true a false en el mismo tick, el navegador
      // podría no animar la entrada la primera vez.
      void overlay.offsetHeight;
      overlay.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      if (closeBtn) closeBtn.focus();
    }

    function close() {
      overlay.classList.remove('is-open');
      document.body.style.overflow = '';
      var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var finish = function () {
        overlay.hidden = true;
        img.src = '';
      };
      if (reduceMotion) {
        finish();
      } else {
        // Duración de --duration-reveal (ver image-lightbox.css) + un
        // margen chico — más simple que escuchar transitionend en dos
        // propiedades distintas (fondo e imagen) y desduplicar.
        setTimeout(finish, 520);
      }
      if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    }

    document.querySelectorAll('img.flagship__image, img.project-card__image').forEach(function (el) {
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.addEventListener('click', function () { open(el); });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open(el);
        }
      });
    });

    if (closeBtn) closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });

    document.addEventListener('keydown', function (e) {
      if (overlay.hidden) return;
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key === 'Tab') {
        var items = Array.prototype.slice.call(overlay.querySelectorAll(FOCUSABLE_SELECTOR));
        if (!items.length) return;
        var first = items[0];
        var last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  });
})();
