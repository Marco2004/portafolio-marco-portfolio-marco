(function () {
  var STORAGE_KEY = 'mpv_theme';
  var root = document.documentElement;
  var darkMql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Solo existen dos estados visibles: "dark" y "light". Mientras no haya
  // una elección manual guardada, se sigue la preferencia del sistema
  // operativo en vivo (ver el listener de darkMql más abajo) — si cambia el
  // tema del sistema con la pestaña abierta, la página lo refleja. El botón
  // permite anular esto manualmente y esa elección se recuerda de forma
  // permanente (localStorage, misma clave que usa el Dashboard) para que la
  // próxima visita respete el último tema elegido. No hay tercer botón
  // "Automático".
  function storedMode() {
    var stored;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    return (stored === 'dark' || stored === 'light') ? stored : null;
  }

  function systemMode() {
    return (darkMql && darkMql.matches) ? 'dark' : 'light';
  }

  function currentMode() {
    return storedMode() || systemMode();
  }

  // 1000ms — debe coincidir con --duration-theme en variables.css. Mientras
  // dura, .theme-transitioning (ver base.css) hace que TODO lo que cambia de
  // color por el tema se anime a esta misma velocidad, en vez de que cada
  // elemento use la duración que tenga declarada para su propia transición
  // de hover/foco (o ninguna) — eso hacía que unas cosas cambiaran de golpe
  // mientras otras (las que sí tenían su propia transición a
  // --duration-theme, como <body>/.nav) fundían mucho más lento.
  var THEME_TRANSITION_MS = 1000;
  var themeTransitionTimer = null;

  function applyMode(mode) {
    if (!reduceMotion) {
      root.classList.add('theme-transitioning');
      clearTimeout(themeTransitionTimer);
      themeTransitionTimer = setTimeout(function () {
        root.classList.remove('theme-transitioning');
      }, THEME_TRANSITION_MS);
    }
    root.setAttribute('data-theme', mode);
  }

  function labelFor(mode) {
    var d = window.MPV && window.MPV.i18n ? window.MPV.i18n.currentDict() : {};
    return mode === 'dark' ? (d['theme.dark'] || 'Oscuro') : (d['theme.light'] || 'Claro');
  }

  // Mismo fundido (fade) de opacidad y misma duración (200ms) que usa el
  // cambio de idioma (ver fadeSwap() en i18n.js) — para que alternar tema e
  // idioma se sientan como el mismo lenguaje de movimiento del sitio en vez
  // de dos efectos distintos. animate=false en la carga inicial y cuando un
  // cambio de idioma solo retraduce la etiqueta sin que el modo en sí haya
  // cambiado.
  var FADE_MS = 200;

  function fadeSwap(el, mutate, animate) {
    if (!animate || reduceMotion) { mutate(); return; }
    var prevTransition = el.style.transition;
    el.style.transition = 'opacity ' + FADE_MS + 'ms ease';
    el.style.opacity = '0';
    setTimeout(function () {
      mutate();
      el.style.opacity = '1';
      setTimeout(function () {
        el.style.transition = prevTransition;
      }, FADE_MS);
    }, FADE_MS);
  }

  function updateLabels(animate) {
    var mode = currentMode();
    document.querySelectorAll('[data-theme-label]').forEach(function (el) {
      fadeSwap(el, function () { el.textContent = labelFor(mode); }, animate);
    });
  }

  function updateIcons(animate) {
    if (!window.MPVIcons) return;
    var mode = currentMode();
    document.querySelectorAll('[data-theme-icon]').forEach(function (el) {
      fadeSwap(el, function () { el.innerHTML = mode === 'light' ? window.MPVIcons.sun : window.MPVIcons.moon; }, animate);
    });
  }

  function toggleTheme() {
    var next = currentMode() === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
    applyMode(next);
    updateLabels(true);
    updateIcons(true);
  }

  document.addEventListener('DOMContentLoaded', function () {
    updateLabels(false);
    updateIcons(false);
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.addEventListener('click', toggleTheme);
    });
    // Solo retraduce la etiqueta ("Claro"/"Oscuro") al idioma nuevo — el modo
    // de tema no cambió, así que no tiene sentido animar esto como si fuera
    // un toggle real.
    document.addEventListener('mpv:langchange', function () { updateLabels(false); });
  });

  // Mientras no exista una elección manual guardada, seguir el sistema en
  // vivo si cambia mientras la pestaña sigue abierta.
  if (darkMql && darkMql.addEventListener) {
    darkMql.addEventListener('change', function () {
      if (!storedMode()) {
        applyMode(systemMode());
        updateLabels(true);
        updateIcons(true);
      }
    });
  }
})();
