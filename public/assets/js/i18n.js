(function () {
  var dataEl = document.getElementById('i18n-data');
  var dict = { es: {}, en: {} };
  try { dict = JSON.parse(dataEl.textContent); } catch (e) {}

  var STORAGE_KEY = 'mpv_lang';
  var lang;
  // Elección manual (botón ES/EN), si existe, solo se recuerda para la
  // sesión actual del navegador (sessionStorage) — nunca se persiste de
  // forma permanente. Sin elección manual, siempre se sigue el idioma del
  // sistema/navegador.
  try { lang = sessionStorage.getItem(STORAGE_KEY); } catch (e) {}
  if (lang !== 'es' && lang !== 'en') {
    var browserLang = (navigator.language || (navigator.languages && navigator.languages[0]) || '').toLowerCase();
    if (browserLang.indexOf('en') === 0) {
      lang = 'en';
    } else if (browserLang.indexOf('es') === 0) {
      lang = 'es';
    } else {
      lang = document.documentElement.lang === 'en' ? 'en' : 'es';
    }
  }

  function currentDict() {
    return dict[lang] || dict.es;
  }

  // Fundido (fade) al cambiar de idioma con el botón ES/EN: el texto se
  // atenúa, cambia por debajo y vuelve a aparecer. Antes había un efecto de
  // "descifrado" (caracteres al azar resolviéndose de izquierda a derecha)
  // que se disparaba en CADA carga de página en cuanto el idioma detectado
  // (sessionStorage o idioma del navegador) no coincidía con el español con
  // el que el servidor siempre renderiza el HTML — es decir, en casi
  // cualquier visita de alguien con el navegador en inglés. Ahora esa
  // animación solo ocurre cuando se hace clic en el botón (ver
  // DOMContentLoaded más abajo, que aplica el idioma inicial sin animar).
  // Respeta prefers-reduced-motion con un swap instantáneo. Duración
  // alineada con --duration-base (.2s) de variables.css.
  var FADE_MS = 200;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fadeSwap(el, setFinal) {
    if (reduceMotion) { setFinal(); return; }
    var prevTransition = el.style.transition;
    el.style.transition = 'opacity ' + FADE_MS + 'ms ease';
    el.style.opacity = '0';
    setTimeout(function () {
      setFinal();
      el.style.opacity = '1';
      setTimeout(function () {
        el.style.transition = prevTransition;
      }, FADE_MS);
    }, FADE_MS);
  }

  function applyLang(next, animate) {
    lang = next === 'en' ? 'en' : 'es';
    var d = currentDict();
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (d[key] == null) return;
      var setFinal = function () { el.textContent = d[key]; };
      if (animate) fadeSwap(el, setFinal); else setFinal();
    });
    // Contenido editado a mano desde el dashboard (proyectos, experiencia,
    // etc.) — cada nodo trae su propio par data-es/data-en (ver dyn_attrs()
    // en src/helpers.php), a diferencia de [data-i18n] que usa el
    // diccionario fijo de arriba.
    document.querySelectorAll('[data-i18n-dynamic]').forEach(function (el) {
      var value = lang === 'en' ? el.getAttribute('data-en') : el.getAttribute('data-es');
      if (value == null) return;
      var setFinal = function () { el.textContent = value; };
      if (animate) fadeSwap(el, setFinal); else setFinal();
    });
    document.querySelectorAll('[data-lang-label]').forEach(function (el) {
      el.textContent = lang === 'en' ? 'ES' : 'EN';
    });
    document.documentElement.lang = lang;
    try { sessionStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    document.dispatchEvent(new CustomEvent('mpv:langchange', { detail: { lang: lang } }));
  }

  window.MPV = window.MPV || {};
  window.MPV.i18n = { getLang: function () { return lang; }, currentDict: currentDict, applyLang: applyLang };

  document.addEventListener('DOMContentLoaded', function () {
    // Sin animar: es la primera pintura del contenido en el idioma que
    // corresponde, no un cambio que el visitante ve ocurrir.
    if (lang !== document.documentElement.lang) {
      applyLang(lang, false);
    }
    document.querySelectorAll('[data-lang-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyLang(lang === 'en' ? 'es' : 'en', true);
      });
    });
  });
})();
