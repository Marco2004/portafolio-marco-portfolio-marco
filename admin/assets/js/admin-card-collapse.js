/**
 * Tarjetas plegables estáticas del panel (Encabezado, Ficha rápida, Redes
 * sociales, Idiomas, Certificaciones, Medios de contacto, Disponibilidad,
 * CV — punto 8 de la ronda de organización del dashboard). Mismo lenguaje
 * visual que el acordeón de las listas repetibles (ver applyAccordionState()
 * en admin-forms.js), pero sin lista/índice detrás: estas tarjetas son fijas
 * (siempre existe una sola), así que el estado de apertura solo vive en la
 * clase .is-collapsed del propio elemento mientras dura la sesión — no se
 * guarda entre recargas, todas empiezan abiertas (igual que se veían antes
 * de este cambio).
 *
 * collapseBody() vive aquí (y no en admin-forms.js) porque este script carga
 * primero y lo usan ambos: las tarjetas estáticas de este archivo y el
 * acordeón de listas repetibles de admin-forms.js.
 */
(function () {
  /**
   * Anima el alto real de `body` entre 0 y su altura de contenido medida
   * (scrollHeight) — no un tope arbitrario en CSS — para que la curva de
   * easing recorra justo el rango visible y el movimiento se sienta como un
   * solo trazo continuo en vez de "rebotar" cuando el contenido real es
   * mucho más chico que el tope fijo.
   *
   * También anima padding-top/padding-bottom en sincronía con max-height (no
   * como una segunda transición aparte): algunos de estos contenedores
   * (.repeat-card__body) son display:flex con su propio padding, y ahí
   * max-height:0 solo no basta — Chromium deja un remanente visible del
   * tamaño del padding aunque el contenido ya esté recortado. Si el padding
   * cambia exactamente al mismo tiempo que max-height (mismo frame, mismo
   * destino), la curva de easing los recorre juntos como un solo movimiento
   * en vez de dos transiciones desacopladas "rebotando".
   */
  function collapseBody(body, open) {
    if (!body) return;
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      body.style.transition = 'none';
      body.style.overflow = open ? '' : 'hidden';
      body.style.maxHeight = open ? 'none' : '0px';
      body.style.paddingTop = open ? '' : '0px';
      body.style.paddingBottom = open ? '' : '0px';
      void body.offsetHeight;
      body.style.transition = '';
      return;
    }

    var startCs = getComputedStyle(body);
    var startHeight = body.getBoundingClientRect().height;
    var startPadTop = startCs.paddingTop;
    var startPadBottom = startCs.paddingBottom;

    var targetHeight, targetPadTop, targetPadBottom;
    if (open) {
      // Mide el destino en un CLON aislado, no en `body` mismo — probamos
      // primero limpiar max-height/overflow/padding en línea sobre el propio
      // `body` para medir, y aun con .is-collapsed ya quitado de la tarjeta
      // seguía midiendo el padding como 0: si `body` tenía una transición de
      // padding en vuelo (o recién terminada) de un toggle anterior,
      // getComputedStyle() puede seguir reportando el valor animado en vez
      // del que de verdad le tocaría por CSS. Un clon nuevo, insertado sin
      // ninguna transición ni estilo en línea heredado, no tiene ese
      // problema — mide el tamaño natural real sin ambigüedad. Se posiciona
      // fuera de pantalla (no display:none, que sí afectaría a scrollHeight)
      // y con el mismo ancho que la tarjeta real para que el texto envuelva
      // igual.
      var clone = body.cloneNode(true);
      clone.style.position = 'absolute';
      clone.style.visibility = 'hidden';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      clone.style.width = body.getBoundingClientRect().width + 'px';
      clone.style.maxHeight = 'none';
      clone.style.overflow = 'visible';
      clone.style.transition = 'none';
      clone.style.paddingTop = '';
      clone.style.paddingBottom = '';
      document.body.appendChild(clone);
      targetHeight = clone.scrollHeight;
      var cloneCs = getComputedStyle(clone);
      targetPadTop = cloneCs.paddingTop;
      targetPadBottom = cloneCs.paddingBottom;
      clone.remove();
    } else {
      targetHeight = 0;
      targetPadTop = '0px';
      targetPadBottom = '0px';
    }

    // Fija el punto de partida explícito (alto y padding actuales) antes de
    // mover el destino — si no, salta directo sin animar.
    body.style.overflow = 'hidden';
    body.style.maxHeight = startHeight + 'px';
    body.style.paddingTop = startPadTop;
    body.style.paddingBottom = startPadBottom;
    void body.offsetHeight;

    requestAnimationFrame(function () {
      body.style.maxHeight = targetHeight + 'px';
      body.style.paddingTop = targetPadTop;
      body.style.paddingBottom = targetPadBottom;
    });

    var cleanup = function (ev) {
      if (ev.target !== body || ev.propertyName !== 'max-height') return;
      body.removeEventListener('transitionend', cleanup);
      if (open) {
        // Deja de limitar la altura para que contenido agregado después (una
        // fila nueva, un error de validación, el calendario del datepicker)
        // no quede recortado por el valor medido en este toggle.
        body.style.maxHeight = 'none';
        body.style.overflow = '';
        body.style.paddingTop = '';
        body.style.paddingBottom = '';
      }
    };
    body.addEventListener('transitionend', cleanup);
  }

  window.MPVAdmin = window.MPVAdmin || {};
  window.MPVAdmin.collapseBody = collapseBody;

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-collapsible-card]').forEach(function (card) {
      var head = card.querySelector('[data-card-toggle]');
      var body = card.querySelector('.card__body');
      if (!head) return;
      head.addEventListener('click', function () {
        var collapsed = card.classList.toggle('is-collapsed');
        head.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        collapseBody(body, !collapsed);
      });
    });
  });
})();
