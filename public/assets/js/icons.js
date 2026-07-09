/**
 * Íconos SVG del sitio público — solo sol/luna por ahora, para el switch de
 * tema del nav (mismo trazo que admin/assets/js/admin-icons.js del
 * dashboard; se repite aquí en vez de compartirse porque public/ y admin/
 * son dos apps servidas por separado, sin bundle en común — mismo criterio
 * que ya usa el proyecto para variables.css/admin-base.css).
 */
(function () {
  function svg(inner) {
    return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" ' +
      'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }

  window.MPVIcons = {
    sun: svg('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7"/>'),
    moon: svg('<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>'),
  };
})();
