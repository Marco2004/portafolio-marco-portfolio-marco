/**
 * Selector de color reutilizable para los "LED"/indicadores que antes tenían
 * un color fijo por CSS (disponibilidad de Inicio, insignia de Contacto) y
 * para el color de cada nivel de habilidad — punto 7/11/12 de la ronda de
 * personalización.
 *
 * Interacción: un solo chip clicable (mismo lenguaje visual que .chip-tag)
 * — clic abre el selector de color nativo y el color elegido se aplica de
 * inmediato, sin un paso aparte de "activar personalización" primero. Una ×
 * aparte (solo visible cuando hay un color propio) regresa a "automático"
 * (el sitio público usa su color por defecto, que sigue el tema claro/
 * oscuro solo — ver hero.css/skills.css) sin perder el último tono elegido:
 * si se vuelve a abrir el selector, empieza desde ese mismo tono.
 */
window.MPVColorPicker = (function () {
  function t(key) {
    return window.MPVAdminI18n ? window.MPVAdminI18n.t(key) : key;
  }

  function enhance(root) {
    (root || document).querySelectorAll('[data-color-picker]').forEach(function (el) {
      var path = el.getAttribute('data-color-picker');
      var input = el.querySelector('[data-color-input]');
      var swatchBtn = el.querySelector('[data-color-swatch]');
      var dot = el.querySelector('[data-color-dot]');
      var label = el.querySelector('[data-color-label]');
      var resetBtn = el.querySelector('[data-color-reset]');
      if (!input || !swatchBtn) return;

      function currentValue() {
        return window.MPVAdmin.getByPath(window.MPVAdmin.state, path) || '';
      }

      function sync() {
        var val = currentValue();
        var effective = val || input.dataset.default || '#3fb950';
        if (dot) dot.style.background = effective;
        input.value = effective;
        if (label) label.textContent = val ? t('admin.color.custom') : t('admin.color.automatic');
        if (resetBtn) resetBtn.hidden = !val;
      }

      if (!el.dataset.colorBound) {
        el.dataset.colorBound = '1';
        swatchBtn.addEventListener('click', function () {
          input.click();
        });
        input.addEventListener('input', function () {
          window.MPVAdmin.setByPath(window.MPVAdmin.state, path, input.value);
          window.MPVAdmin.notifyChange(true);
          sync();
        });
        if (resetBtn) {
          resetBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            window.MPVAdmin.setByPath(window.MPVAdmin.state, path, '');
            window.MPVAdmin.notifyChange(true);
            sync();
          });
        }
      }
      sync();
    });
  }

  document.addEventListener('DOMContentLoaded', function () { enhance(document); });
  // La etiqueta "Automático"/"Personalizado" (data-color-label) depende del
  // estado (no solo del idioma), así que no puede ser un [data-i18n]
  // estático de admin-i18n.js — se re-sincroniza aquí a mano en cada cambio
  // de idioma de interfaz.
  document.addEventListener('mpv-admin:langchange', function () { enhance(document); });

  return { enhance: enhance, t: t };
})();
