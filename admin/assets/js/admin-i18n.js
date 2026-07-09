/**
 * Idioma de la INTERFAZ del dashboard (menú, botones, títulos de tarjeta,
 * textos de ayuda) — antes todo esto era español fijo en admin/index.php.
 * Distinto y completamente independiente del toggle "Editando: Español /
 * English" (data-edit-lang, ver admin-sections.js), que solo decide en qué
 * idioma se guarda el CONTENIDO que el admin escribe (nombre del proyecto,
 * descripción, etc.) — ese sigue funcionando exactamente igual que antes.
 *
 * Mismo criterio sistema+sesión que el tema (punto 2): por default sigue el
 * idioma del navegador; una elección manual (con el mismo botón "Editando:
 * Español/English" del topbar, que además de elegir el idioma de contenido
 * ahora también cambia el idioma de la interfaz) solo se recuerda para la
 * sesión actual, en sessionStorage, nunca de forma permanente.
 */
(function () {
  var STORAGE_KEY = 'mpv_admin_lang';
  var dict = { es: {}, en: {} };

  try {
    dict = JSON.parse(document.getElementById('admin-i18n-data').textContent);
  } catch (e) {}

  function storedLang() {
    var stored;
    try { stored = sessionStorage.getItem(STORAGE_KEY); } catch (e) {}
    return (stored === 'es' || stored === 'en') ? stored : null;
  }

  function systemLang() {
    var browserLang = (navigator.language || (navigator.languages && navigator.languages[0]) || '').toLowerCase();
    return browserLang.indexOf('en') === 0 ? 'en' : 'es';
  }

  function currentLang() {
    return storedLang() || systemLang();
  }

  function currentDict() {
    return dict[currentLang()] || dict.es;
  }

  function t(key) {
    var d = currentDict();
    return (d && d[key] != null) ? d[key] : (dict.es[key] || key);
  }

  // Mismo fundido (fade) de opacidad y misma duración (200ms) que usa el
  // cambio de idioma del sitio público (i18n.js) — antes este texto cambiaba
  // de golpe, sin animación, a diferencia del sitio público. Solo se anima
  // el texto visible ([data-i18n]); title/aria-label/placeholder no son
  // visibles de por sí, así que animarlos no aportaría nada.
  var FADE_MS = 200;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fadeSwap(el, finalText) {
    if (reduceMotion) { el.textContent = finalText; return; }
    var prevTransition = el.style.transition;
    el.style.transition = 'opacity ' + FADE_MS + 'ms ease';
    el.style.opacity = '0';
    setTimeout(function () {
      el.textContent = finalText;
      el.style.opacity = '1';
      setTimeout(function () {
        el.style.transition = prevTransition;
      }, FADE_MS);
    }, FADE_MS);
  }

  // animate=false en la carga inicial de la página (no tiene sentido
  // "entrar" antes de que la página siquiera se vea) — solo se anima cuando
  // el botón "Editando: Español/English" dispara un cambio real (setLang()).
  function applyStaticI18n(animate) {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var text = t(el.getAttribute('data-i18n'));
      if (animate) fadeSwap(el, text); else el.textContent = text;
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
  }

  function setLang(lang) {
    lang = lang === 'en' ? 'en' : 'es';
    try { sessionStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    applyStaticI18n(true);
    document.dispatchEvent(new CustomEvent('mpv-admin:langchange'));
  }

  window.MPVAdminI18n = { t: t, currentLang: currentLang, setLang: setLang, applyStaticI18n: applyStaticI18n };

  document.addEventListener('DOMContentLoaded', function () { applyStaticI18n(false); });
})();
