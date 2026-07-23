/**
 * Escapado de HTML compartido por los scripts del dashboard que arman markup
 * por concatenación de strings (mismo criterio que e() en src/helpers.php,
 * del lado del cliente) — antes esta misma función vivía copiada de forma
 * idéntica en admin-chip-input.js, admin-forms.js, admin-preview.js y
 * admin-social-links.js; centralizada aquí para no repetirla.
 */
(function () {
  function html(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Un único escapado sirve para texto de nodo y para valores dentro de
  // atributos entre comillas dobles — se exponen los dos nombres porque cada
  // script que lo usaba ya distinguía "escapeHtml"/"escapeAttr" en sus
  // llamadas (documenta la intención en el sitio de uso), aunque ambos
  // apunten a la misma implementación.
  window.MPVEscape = { html: html, attr: html };
})();
