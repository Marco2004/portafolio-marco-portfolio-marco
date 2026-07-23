/**
 * Convierte un <input type="hidden"> con valor "a, b, c" en una entrada de
 * "chips" (tecnologías, métricas, etc.) para que quien usa el dashboard no
 * tenga que escribir el formato separado por comas a mano: puede escribir y
 * presionar Enter, pegar una lista completa (separada por coma, punto y
 * coma o salto de línea), o dar clic en la ✕ de un chip para quitarlo.
 *
 * Solo separa por coma/punto y coma/salto de línea — nunca por espacios,
 * para no partir nombres compuestos como "Node.js" o "Visual Studio Code".
 *
 * El <input hidden> sigue siendo la fuente de verdad que ya lee
 * admin-forms.js (mismo data-field="...Str", mismo formato "a, b, c"): este
 * módulo solo le pone una interfaz más amigable encima y dispara un evento
 * "input" real sobre el hidden para que el resto del código seguido
 * funcione sin cambios.
 */
(function () {
  // Definida una sola vez en admin-escape.js (window.MPVEscape), cargado
  // antes que este archivo — ver ese archivo para el porqué.
  var escapeHtml = window.MPVEscape.html;

  function parseList(raw) {
    var seen = {};
    var out = [];
    String(raw || '').split(/[,;\n]+/).forEach(function (part) {
      var value = part.trim().replace(/\s+/g, ' ');
      if (!value) return;
      var key = value.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      out.push(value);
    });
    return out;
  }

  function enhanceOne(wrapper) {
    var hidden = wrapper.querySelector('[data-chip-hidden]');
    var list = wrapper.querySelector('[data-chip-list]');
    var textInput = wrapper.querySelector('[data-chip-text]');
    if (!hidden || !list || !textInput) return;

    var tags = parseList(hidden.value);

    function render() {
      list.innerHTML = tags.map(function (tag, i) {
        var removePrefix = window.MPVAdminI18n ? window.MPVAdminI18n.t('admin.social.removeAriaPrefix') : 'Quitar';
        return '<span class="chip-tag">' + escapeHtml(tag) +
          '<button type="button" class="chip-tag__remove" data-i="' + i + '" aria-label="' + escapeHtml(removePrefix + ' ' + tag) + '">&times;</button></span>';
      }).join('');
    }

    function commit() {
      hidden.value = tags.join(', ');
      hidden.dispatchEvent(new Event('input', { bubbles: true }));
      render();
    }

    function addFromText(raw) {
      var incoming = parseList(raw);
      var changed = false;
      incoming.forEach(function (value) {
        var key = value.toLowerCase();
        if (!tags.some(function (t) { return t.toLowerCase() === key; })) {
          tags.push(value);
          changed = true;
        }
      });
      if (changed) commit();
    }

    render();

    textInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
        e.preventDefault();
        if (textInput.value.trim()) {
          addFromText(textInput.value);
          textInput.value = '';
        }
      } else if (e.key === 'Backspace' && textInput.value === '' && tags.length) {
        tags.pop();
        commit();
      }
    });

    textInput.addEventListener('paste', function (e) {
      var pasted = (e.clipboardData || window.clipboardData).getData('text');
      if (/[,;\n]/.test(pasted)) {
        e.preventDefault();
        addFromText(pasted);
      }
    });

    textInput.addEventListener('blur', function () {
      if (textInput.value.trim()) {
        addFromText(textInput.value);
        textInput.value = '';
      }
    });

    list.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-i]');
      if (!btn) return;
      tags.splice(Number(btn.dataset.i), 1);
      commit();
    });
  }

  function enhance(root) {
    (root || document).querySelectorAll('[data-chip-input]').forEach(enhanceOne);
  }

  window.MPVChipInput = { enhance: enhance, parseList: parseList };
})();
