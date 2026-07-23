/**
 * Menú hamburguesa del nav público — solo actúa por debajo de 760px (ver
 * responsive.css, detrás de .has-js): agrupa los links + botones de
 * idioma/tema/CV detrás de un botón para que el nav no ocupe varias filas
 * en un celular. Estado real: la clase "is-open" en [data-nav-links]
 * (animada por CSS); este archivo solo la agrega/quita y sincroniza
 * aria-expanded + el ícono del botón. Sin JS, o en escritorio/tablet
 * (min-width:761px vía CSS), .nav__links vuelve a su disposición normal
 * siempre visible — ver el fallback ".has-js" en responsive.css.
 */
(function () {
  var toggle = document.querySelector('[data-nav-menu-toggle]');
  var links = document.querySelector('[data-nav-links]');
  var icon = document.querySelector('[data-nav-menu-icon]');
  var brand = document.querySelector('.nav__brand');
  if (!toggle || !links) return;

  function isOpen() {
    return links.classList.contains('is-open');
  }

  function setIcon(open) {
    if (!icon || !window.MPVIcons) return;
    icon.innerHTML = open ? window.MPVIcons.close : window.MPVIcons.menu;
  }

  function open() {
    links.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    setIcon(true);
  }

  function close() {
    links.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    setIcon(false);
  }

  toggle.addEventListener('click', function () {
    if (isOpen()) close(); else open();
  });

  // Elegir un link (o el botón "Ver CV") cierra el menú — es una navegación
  // de una sola pantalla (anclas de scroll), así que dejarlo abierto después
  // de elegir no tiene sentido, igual que cualquier menú móvil típico.
  // composedPath() otra vez, no e.target.closest(): tanto el botón de tema
  // (theme.js) como el de idioma reemplazan su propio ícono al hacer clic,
  // lo que desconecta el <svg>/<span> exacto que originó el evento antes de
  // que este handler llegue a correr — closest() sobre ese nodo ya
  // desconectado nunca encuentra nada, así que elegir tema/idioma no cerraría
  // el menú (solo los <a> normales, que no mutan nada, sí funcionarían).
  links.addEventListener('click', function (e) {
    var path = typeof e.composedPath === 'function' ? e.composedPath() : [e.target];
    var hitLinkOrButton = path.some(function (el) {
      return el.tagName === 'A' || el.tagName === 'BUTTON';
    });
    if (hitLinkOrButton) close();
  });

  // El logo + "Portafolio Web" (.nav__brand, vuelve a #top) es TAMBIÉN un
  // destino de navegación, igual que los links de arriba, pero vive fuera
  // de [data-nav-links] (está siempre visible, no se colapsa) — sin esto,
  // elegirlo con el menú móvil abierto navegaba arriba pero dejaba el panel
  // del menú abierto flotando encima del contenido.
  if (brand) {
    brand.addEventListener('click', function () {
      if (isOpen()) close();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) {
      close();
      toggle.focus();
    }
  });

  // Clic fuera del nav también cierra — mismo criterio que los paneles
  // flotantes del dashboard (ver admin-combo.js).
  // e.composedPath() (no e.target.closest()) a propósito: abrir el menú
  // reemplaza el ícono del botón (setIcon() cambia su innerHTML), lo que
  // destruye el <svg> exacto que originó el clic — closest() sobre un
  // elemento ya desconectado del documento nunca encuentra .nav__inner
  // (siempre da "está afuera", cerrando el menú apenas se abre).
  // composedPath() congela la ruta original del evento antes de esa mutación,
  // así que sigue siendo correcta sin importar qué cambie el DOM después.
  var navInner = document.querySelector('.nav__inner');
  document.addEventListener('click', function (e) {
    var path = typeof e.composedPath === 'function' ? e.composedPath() : [];
    if (isOpen() && navInner && path.indexOf(navInner) === -1) close();
  });

  // Si la ventana crece más allá de 760px con el menú abierto (o al revés),
  // CSS ya vuelve a mostrar .nav__links siempre visible por su cuenta — solo
  // hay que resetear el estado de "abierto"/aria-expanded para que no quede
  // desincronizado si la pantalla vuelve a achicarse después.
  //
  // El cierre se fuerza SIN transición (nav__links--no-transition, ver
  // responsive.css): el panel nunca estuvo "abierto" desde la perspectiva
  // de quien está redimensionando la ventana, así que no debe animar un
  // cierre que nadie vio abrirse — sin esto, opacity/visibility tardan
  // var(--duration-base) (~200ms) en aplicarse el instante justo en que la
  // ventana cruza a layout móvil, dejando el panel visible (y clickeable)
  // ese lapso. Se remueve la clase enseguida (con un reflow forzado de por
  // medio) para no afectar la animación real de abrir/cerrar con clic,
  // Escape o clic afuera.
  var mq = window.matchMedia('(max-width: 760px)');
  function syncToViewport() {
    links.classList.add('nav__links--no-transition');
    close();
    void links.offsetHeight; // fuerza el reflow: aplica el cierre antes de reactivar la transición
    links.classList.remove('nav__links--no-transition');
  }
  if (mq.addEventListener) mq.addEventListener('change', syncToViewport);
})();
