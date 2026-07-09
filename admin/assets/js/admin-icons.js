/**
 * Iconos SVG compartidos entre los scripts del dashboard (mismo trazo que
 * src/helpers.php::icon(), pero disponibles en JS porque algunas plantillas
 * — filas arrastrables, botones que cambian de estado — se dibujan aquí en
 * vez de en PHP). Centralizado en un solo lugar para no repetir el mismo
 * string de <svg> en cada archivo que necesite uno de estos iconos.
 */
(function () {
  function svg(inner, attrs) {
    return '<svg viewBox="0 0 24 24" width="' + (attrs.width || 15) + '" height="' + (attrs.height || 15) +
      '" fill="' + (attrs.fill || 'none') + '" stroke="' + (attrs.stroke || 'currentColor') +
      '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }

  window.MPVIcons = {
    grip: svg(
      '<circle cx="9" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/>' +
      '<circle cx="15" cy="6" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="15" cy="18" r="1.3"/>',
      { fill: 'currentColor', stroke: 'none' }
    ),
    eye: svg('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>', {}),
    eyeOff: svg(
      '<path d="M3 3l18 18"/><path d="M10.6 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a15.6 15.6 0 0 1-3.2 4.1M6.5 7.4C4 9.1 2.5 12 2.5 12s3.5 6.5 9.5 6.5a9.6 9.6 0 0 0 3.4-.6"/><path d="M9.9 10a3 3 0 0 0 4.2 4.2"/>',
      {}
    ),
    expand: svg('<path d="M9 4H4v5M15 4h5v5M4 15v5h5M20 15v5h-5"/>', {}),
    compress: svg('<path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5"/>', {}),
    chevronLeft: svg('<path d="M15 5 8 12l7 7"/>', {}),
    chevronRight: svg('<path d="M9 5l7 7-7 7"/>', {}),
    sun: svg('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7"/>', {}),
    moon: svg('<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>', {}),
  };
})();
