(function () {
  var current = null;
  var clearTimer = null;

  // El resaltado vive DENTRO del documento del iframe (el sitio real), así
  // que no puede definirse en admin-preview.css (ese CSS no alcanza el
  // interior de otro documento) — se inyecta una sola vez como <style> en su
  // <head> cuando el iframe termina de cargar.
  var HIGHLIGHT_CSS = '' +
    '.flagship, .project-card, .timeline-item, .skill-card, .cert-row {' +
    '  transition: box-shadow .2s ease, outline-color .2s ease;' +
    '  outline: 2px solid transparent;' +
    '  outline-offset: 3px;' +
    '}' +
    '.is-preview-highlighted {' +
    '  outline-color: var(--accent);' +
    '  box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent) 18%, transparent);' +
    '}' +
    '@media (prefers-reduced-motion: reduce) {' +
    '  .flagship, .project-card, .timeline-item, .skill-card, .cert-row { transition: none; }' +
    '}';

  function injectHighlightStyle(doc) {
    if (doc.getElementById('mpv-preview-highlight-style')) return;
    var style = doc.createElement('style');
    style.id = 'mpv-preview-highlight-style';
    style.textContent = HIGHLIGHT_CSS;
    doc.head.appendChild(style);
  }

  function clearHighlight() {
    if (current) {
      current.classList.remove('is-preview-highlighted');
      current = null;
    }
  }

  function setHighlight(el) {
    if (el === current) return;
    clearHighlight();
    if (el) {
      el.classList.add('is-preview-highlighted');
      current = el;
    }
  }

  // Misma agrupación que usan las plantillas de admin-preview.js: un campo
  // dentro de una fila repetible (proyecto, experiencia, categoría de
  // habilidades, certificación) resalta esa tarjeta puntual dentro del
  // iframe; hero/contacto/educación no se resaltan de forma puntual porque
  // no tienen un contenedor "por fila" equivalente en el sitio real.
  function resolveTarget(el) {
    var row = el.closest('[data-project-row], [data-exp-row], [data-cat-row], [data-cert-row]');
    if (!row) return null;
    var index = row.getAttribute('data-index');
    if (row.hasAttribute('data-project-row')) return { target: 'projects', index: index };
    if (row.hasAttribute('data-exp-row')) return { target: 'experience', index: index };
    if (row.hasAttribute('data-cat-row')) return { target: 'skills', index: index };
    if (row.hasAttribute('data-cert-row')) return { target: 'certifications', index: index };
    return null;
  }

  function findPreviewEl(doc, info) {
    return doc.querySelector('[data-preview-target="' + info.target + '"][data-preview-index="' + info.index + '"]');
  }

  // Se reevalúa contra document.activeElement (no contra el evento que
  // disparó la llamada) porque también se ejecuta después de que
  // admin-preview.js reconstruye el HTML del iframe en cada tecla — sin
  // esto, el resaltado desaparecería a la primera letra escrita.
  function applyForActiveElement(formColumn) {
    var frame = window.MPVAdminPreview && window.MPVAdminPreview.getFrame();
    var doc = frame && frame.contentDocument;
    if (!doc) return;
    var active = document.activeElement;
    if (!active || !formColumn.contains(active)) {
      clearHighlight();
      return;
    }
    var info = resolveTarget(active);
    setHighlight(info ? findPreviewEl(doc, info) : null);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var formColumn = document.querySelector('.form-column');
    var frame = document.querySelector('[data-preview-frame]');
    if (!formColumn || !frame) return;

    frame.addEventListener('load', function () {
      try { injectHighlightStyle(frame.contentDocument); } catch (e) {}
    });

    formColumn.addEventListener('focusin', function () {
      clearTimeout(clearTimer);
      applyForActiveElement(formColumn);
    });
    formColumn.addEventListener('focusout', function () {
      clearTimeout(clearTimer);
      clearTimer = setTimeout(function () {
        if (!formColumn.contains(document.activeElement)) clearHighlight();
      }, 120);
    });

    // admin-preview.js reconstruye el HTML del iframe (con un pequeño
    // debounce mientras el admin sigue escribiendo) y dispara
    // "mpv-admin:previewrendered" justo cuando termina — antes esto escuchaba
    // "mpv-admin:change" directamente, que se dispara en cada tecla, ANTES de
    // que exista el DOM nuevo; el nodo anterior ya no existe, así que hay que
    // esperar a que el redibujado real termine para volver a resaltar.
    document.addEventListener('mpv-admin:previewrendered', function () {
      current = null;
      applyForActiveElement(formColumn);
    });
  });
})();
