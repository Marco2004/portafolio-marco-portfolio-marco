/**
 * Modal de confirmación propio (fondo difuminado + tarjeta animada), para
 * reemplazar window.confirm() en las eliminaciones del dashboard — nativo,
 * bloqueante y visualmente ajeno al resto de la interfaz. Se inyecta una
 * sola vez en <body> la primera vez que se usa (no vive en admin/index.php
 * para no ensuciar ese archivo con markup que solo hace falta si se borra algo).
 *
 * API: window.MPVAdmin.confirmDialog(message, { title, confirmLabel }) devuelve
 * una Promise<boolean> — true si se confirmó, false si se canceló (Escape,
 * click fuera, o el botón Cancelar).
 */
(function () {
  var dialogEl = null;
  var activeResolve = null;
  var lastFocused = null;

  function build() {
    var overlay = document.createElement('div');
    overlay.className = 'confirm-dialog-overlay';
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">' +
        '<p class="confirm-dialog__title" id="confirm-dialog-title"></p>' +
        '<p class="confirm-dialog__message" id="confirm-dialog-message"></p>' +
        '<div class="confirm-dialog__actions">' +
          '<button type="button" class="confirm-dialog__cancel" data-confirm-cancel></button>' +
          '<button type="button" class="confirm-dialog__confirm" data-confirm-ok></button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) settle(false);
    });
    overlay.querySelector('[data-confirm-cancel]').addEventListener('click', function () { settle(false); });
    overlay.querySelector('[data-confirm-ok]').addEventListener('click', function () { settle(true); });
    document.addEventListener('keydown', function (e) {
      if (overlay.hidden) return;
      if (e.key === 'Escape') settle(false);
      if (e.key === 'Tab') trapFocus(e, overlay);
    });

    return overlay;
  }

  function trapFocus(e, overlay) {
    var focusable = overlay.querySelectorAll('button');
    var first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function settle(result) {
    if (!activeResolve) return;
    dialogEl.classList.add('is-closing');
    var resolve = activeResolve;
    activeResolve = null;
    setTimeout(function () {
      dialogEl.hidden = true;
      dialogEl.classList.remove('is-closing');
      if (lastFocused && lastFocused.focus) lastFocused.focus();
      resolve(result);
    }, 160);
  }

  function t(key, fallback) {
    return window.MPVAdminI18n ? window.MPVAdminI18n.t(key) : fallback;
  }

  function confirmDialog(message, options) {
    options = options || {};
    if (!dialogEl) dialogEl = build();
    lastFocused = document.activeElement;
    dialogEl.querySelector('#confirm-dialog-title').textContent = options.title || t('admin.forms.confirmDeleteTitle', 'Confirmar eliminación');
    dialogEl.querySelector('#confirm-dialog-message').textContent = message;
    dialogEl.querySelector('[data-confirm-ok]').textContent = options.confirmLabel || t('admin.confirmDialog.confirm', 'Eliminar');
    dialogEl.querySelector('[data-confirm-cancel]').textContent = options.cancelLabel || t('admin.confirmDialog.cancel', 'Cancelar');
    dialogEl.hidden = false;
    return new Promise(function (resolve) {
      activeResolve = resolve;
      // Enfoca Cancelar por defecto (no Eliminar) para que un Enter reflejo
      // no confirme una eliminación por accidente.
      dialogEl.querySelector('[data-confirm-cancel]').focus();
    });
  }

  /**
   * Animación al confirmar una eliminación (proyecto, experiencia,
   * certificación, habilidad, etc.): la fila se desvanece con un ligero
   * encogido y enseguida colapsa su alto/márgenes a 0, para que las filas de
   * abajo suban en el mismo movimiento en vez de que el bloque desaparezca
   * de golpe con un splice+render inmediato. Dos etapas en una sola
   * animación (fundido primero, colapso después) en vez de un solo cambio
   * simultáneo — se siente más intencional, como quitar una tarjeta de una
   * lista en vez de que "explote". Vive aquí porque es el módulo hermano de
   * esta interacción (confirmar → animar → recién ahí borrar del estado).
   *
   * Devuelve una Promise que se resuelve cuando termina la animación (o de
   * inmediato si el elemento no existe, no hay soporte de Web Animations, o
   * el usuario pidió "reducir movimiento" — en ese caso no tiene sentido
   * animar nada, se borra directo).
   */
  function dustDisintegrate(el) {
    if (!el || !el.animate) return Promise.resolve();
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return Promise.resolve();

    var rect = el.getBoundingClientRect();
    if (rect.height === 0) return Promise.resolve();

    // Misma curva que el resto del proyecto usa para sus animaciones de
    // entrada/salida (--ease-reveal en admin-base.css).
    var EASE_REVEAL = 'cubic-bezier(.22, .61, .36, 1)';
    var computed = getComputedStyle(el);
    var startHeight = rect.height;
    var startMarginTop = parseFloat(computed.marginTop) || 0;
    var startMarginBottom = parseFloat(computed.marginBottom) || 0;

    // Fija la altura actual en px (con "height: auto" el motor no puede
    // animar hacia 0) y oculta lo que sobresalga mientras colapsa.
    el.style.height = startHeight + 'px';
    el.style.overflow = 'hidden';

    // Resplandor rojo difuminado + un tinte de fondo del mismo color — el
    // resplandor solo (inset box-shadow) se notaba poco en filas sin borde
    // ni fondo propio (p. ej. una fila de habilidad o de dato rápido, sin
    // tarjeta alrededor), porque no había "borde" visible contra el que se
    // notara el brillo. El tinte de fondo sí se nota siempre, tenga o no
    // borde la fila. Tres tiempos leíbles: (1) el resplandor + tinte
    // aparecen y SE QUEDAN un instante sobre la fila todavía intacta —
    // "esto es lo que se va a borrar" — (2) recién entonces se desvanece, y
    // (3) al final se cierra el espacio. Misma curva que el resto del
    // proyecto (--ease-reveal). var(--red) no se interpola bien dentro de
    // Web Animations API en todos los motores, así que se resuelve a rgb
    // concreto antes de armar los keyframes.
    var redColor = getComputedStyle(document.documentElement).getPropertyValue('--red').trim() || '#ff7b72';
    var m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(redColor);
    var redRgb = m ? (parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16)) : '255,123,114';
    var glowOn = 'inset 0 0 0 1px rgba(' + redRgb + ', .45), inset 0 0 30px 4px rgba(' + redRgb + ', .35)';
    var glowOff = 'inset 0 0 0 1px rgba(' + redRgb + ', 0), inset 0 0 30px 4px rgba(' + redRgb + ', 0)';
    var tintOn = 'rgba(' + redRgb + ', .16)';
    var tintOff = 'rgba(' + redRgb + ', 0)';
    var startRadius = computed.borderRadius && computed.borderRadius !== '0px' ? computed.borderRadius : '8px';

    var animation = el.animate([
      { opacity: 1, transform: 'scale(1)', height: startHeight + 'px', marginTop: startMarginTop + 'px', marginBottom: startMarginBottom + 'px', boxShadow: glowOff, backgroundColor: tintOff, borderRadius: startRadius, offset: 0 },
      { opacity: 1, transform: 'scale(1)', height: startHeight + 'px', marginTop: startMarginTop + 'px', marginBottom: startMarginBottom + 'px', boxShadow: glowOn, backgroundColor: tintOn, borderRadius: startRadius, offset: 0.2 },
      { opacity: 1, transform: 'scale(1)', height: startHeight + 'px', marginTop: startMarginTop + 'px', marginBottom: startMarginBottom + 'px', boxShadow: glowOn, backgroundColor: tintOn, borderRadius: startRadius, offset: 0.45 },
      { opacity: 0, transform: 'scale(.97)', height: startHeight + 'px', marginTop: startMarginTop + 'px', marginBottom: startMarginBottom + 'px', boxShadow: glowOff, backgroundColor: tintOff, borderRadius: startRadius, offset: 0.68 },
      { opacity: 0, transform: 'scale(.97)', height: '0px', marginTop: '0px', marginBottom: '0px', boxShadow: glowOff, backgroundColor: tintOff, borderRadius: startRadius, offset: 1 }
    ], { duration: 650, easing: EASE_REVEAL, fill: 'forwards' });

    return new Promise(function (resolve) {
      animation.onfinish = animation.oncancel = function () {
        resolve();
      };
    });
  }

  window.MPVAdmin = window.MPVAdmin || {};
  window.MPVAdmin.confirmDialog = confirmDialog;
  window.MPVAdmin.dustDisintegrate = dustDisintegrate;
})();
