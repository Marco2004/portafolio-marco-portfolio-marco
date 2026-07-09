/**
 * Redimensionar el ancho del panel de vista previa (arrastrando el borde o
 * con las flechas del teclado) y ampliarlo a pantalla completa. Ambos
 * comportamientos son independientes de mostrar/ocultar el panel (ver
 * admin-sections.js), que solo controla si está colapsado o no.
 */
(function () {
  var WIDTH_KEY = 'mpv_admin_preview_width';
  var MIN_WIDTH = 280;

  function maxWidth() {
    return Math.round(window.innerWidth * 0.7);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var panel = document.querySelector('[data-preview-panel]');
    var handle = document.querySelector('[data-preview-resize]');
    var expandBtn = document.querySelector('[data-preview-expand]');
    if (!panel || !handle) return;

    var savedWidth = null;
    try { savedWidth = parseInt(localStorage.getItem(WIDTH_KEY), 10); } catch (e) {}
    if (savedWidth) {
      panel.style.setProperty('--preview-w', clamp(savedWidth) + 'px');
    }

    function clamp(w) {
      return Math.max(MIN_WIDTH, Math.min(w, maxWidth()));
    }

    var dragging = false;

    function pointerX(e) {
      if (e.touches && e.touches[0]) return e.touches[0].clientX;
      return e.clientX;
    }

    function startDrag(e) {
      dragging = true;
      panel.classList.add('is-resizing');
      document.body.style.userSelect = 'none';
      e.preventDefault();
    }

    function duringDrag(e) {
      if (!dragging) return;
      var x = pointerX(e);
      if (x == null) return;
      var rect = panel.getBoundingClientRect();
      var width = clamp(rect.right - x);
      panel.style.setProperty('--preview-w', width + 'px');
    }

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      panel.classList.remove('is-resizing');
      document.body.style.userSelect = '';
      var width = Math.round(panel.getBoundingClientRect().width);
      try { localStorage.setItem(WIDTH_KEY, String(width)); } catch (e) {}
    }

    handle.addEventListener('mousedown', startDrag);
    handle.addEventListener('touchstart', startDrag, { passive: false });
    window.addEventListener('mousemove', duringDrag);
    window.addEventListener('touchmove', duringDrag, { passive: false });
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('touchend', endDrag);

    // Redimensionar con teclado: el separador es focoable (role="separator"
    // tabindex="0") y responde a las flechas, para quien no usa mouse/touch.
    handle.addEventListener('keydown', function (e) {
      var rect = panel.getBoundingClientRect();
      var width;
      if (e.key === 'ArrowLeft') {
        width = clamp(rect.width + 20);
      } else if (e.key === 'ArrowRight') {
        width = clamp(rect.width - 20);
      } else {
        return;
      }
      e.preventDefault();
      panel.style.setProperty('--preview-w', width + 'px');
      try { localStorage.setItem(WIDTH_KEY, String(Math.round(width))); } catch (e2) {}
    });

    if (expandBtn) {
      var expandIcon = expandBtn.querySelector('[data-preview-expand-icon]');

      function setExpanded(expanded) {
        var t = window.MPVAdminI18n ? window.MPVAdminI18n.t : function (k) { return k; };
        panel.classList.toggle('is-expanded', expanded);
        expandBtn.setAttribute('aria-label', expanded ? t('admin.preview.collapse') : t('admin.preview.expand'));
        if (expandIcon) expandIcon.innerHTML = expanded ? window.MPVIcons.compress : window.MPVIcons.expand;
      }

      expandBtn.addEventListener('click', function () {
        setExpanded(!panel.classList.contains('is-expanded'));
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && panel.classList.contains('is-expanded')) {
          setExpanded(false);
        }
      });
    }
  });
})();
