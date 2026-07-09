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
          '<button type="button" class="confirm-dialog__cancel" data-confirm-cancel>Cancelar</button>' +
          '<button type="button" class="confirm-dialog__confirm" data-confirm-ok>Eliminar</button>' +
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

  function confirmDialog(message, options) {
    options = options || {};
    if (!dialogEl) dialogEl = build();
    lastFocused = document.activeElement;
    dialogEl.querySelector('#confirm-dialog-title').textContent = options.title || 'Confirmar eliminación';
    dialogEl.querySelector('#confirm-dialog-message').textContent = message;
    dialogEl.querySelector('[data-confirm-ok]').textContent = options.confirmLabel || 'Eliminar';
    dialogEl.hidden = false;
    return new Promise(function (resolve) {
      activeResolve = resolve;
      // Enfoca Cancelar por defecto (no Eliminar) para que un Enter reflejo
      // no confirme una eliminación por accidente.
      dialogEl.querySelector('[data-confirm-cancel]').focus();
    });
  }

  /**
   * Animación de "desintegración" al confirmar una eliminación (proyecto,
   * experiencia, certificación, habilidad, etc.): la fila se desvanece y se
   * arrastra hacia un lado mientras una nube de partículas superpuesta se
   * dispersa en la misma dirección, en vez de desaparecer de golpe con un
   * splice+render inmediato. Vive aquí porque es el módulo hermano de esta
   * interacción (confirmar → animar → recién ahí borrar del estado).
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
    if (rect.width === 0 || rect.height === 0) return Promise.resolve();

    // Misma curva que el resto del proyecto usa para sus animaciones de
    // entrada/salida (--ease-reveal en admin-base.css) — antes esto usaba
    // 'ease-out'/'ease-in' genéricos, que se sentían un poco distintos al
    // resto de las transiciones del dashboard.
    var EASE_REVEAL = 'cubic-bezier(.22, .61, .36, 1)';
    var duration = 620;
    var direction = Math.random() < 0.5 ? -1 : 1;

    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; left:' + rect.left + 'px; top:' + rect.top + 'px; ' +
      'width:' + rect.width + 'px; height:' + rect.height + 'px; pointer-events:none; z-index:9999;';
    document.body.appendChild(overlay);

    // Más partículas y más pequeñas que antes (era 22 de 3-8px, ahora 34 de
    // 1.5-4px) para que se lea como polvo fino en vez de confeti; cada una
    // también se desenfoca y encoge al dispersarse, no solo se desvanece.
    var particleCount = 34;
    for (var i = 0; i < particleCount; i++) {
      var particle = document.createElement('span');
      var size = 1.5 + Math.random() * 2.5;
      particle.style.cssText = 'position:absolute; left:' + (Math.random() * rect.width) + 'px; ' +
        'top:' + (Math.random() * rect.height) + 'px; width:' + size + 'px; height:' + size + 'px; ' +
        'border-radius:50%; background:var(--accent); opacity:.8; filter:blur(0px);';
      overlay.appendChild(particle);
      particle.animate([
        { transform: 'translate(0,0) scale(1)', opacity: .8, filter: 'blur(0px)' },
        {
          transform: 'translate(' + (direction * (50 + Math.random() * 100)) + 'px, ' + ((Math.random() - 0.65) * 80) + 'px) scale(.2)',
          opacity: 0,
          filter: 'blur(1px)'
        }
      ], { duration: duration - Math.random() * 180, delay: Math.random() * 110, easing: EASE_REVEAL, fill: 'forwards' });
    }

    var rowAnimation = el.animate([
      { opacity: 1, transform: 'translateX(0) scale(1)', filter: 'blur(0px)' },
      { opacity: 0, transform: 'translateX(' + (direction * 30) + 'px) scale(.97)', filter: 'blur(4px)' }
    ], { duration: duration, easing: EASE_REVEAL, fill: 'forwards' });

    return new Promise(function (resolve) {
      rowAnimation.onfinish = rowAnimation.oncancel = function () {
        overlay.remove();
        resolve();
      };
    });
  }

  window.MPVAdmin = window.MPVAdmin || {};
  window.MPVAdmin.confirmDialog = confirmDialog;
  window.MPVAdmin.dustDisintegrate = dustDisintegrate;
})();
