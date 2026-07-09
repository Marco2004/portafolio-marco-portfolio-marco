(function () {
  var STOPWORDS = { de: true, del: true, la: true, el: true, los: true, las: true, en: true };

  // Convierte una etiqueta libre ("Nivel de Inglés", "Nacionalidad") en una
  // llave estilo variable de JS ("nivelIngles", "nacionalidad") para el
  // objeto falso que dibuja el efecto de código — antes esto era fijo
  // ("ubicacion"/"formacion"/"nivelIngles") porque la Ficha rápida tenía
  // exactamente 3 campos hardcodeados; ahora es una lista libre (punto 3),
  // así que la llave se arma en vivo a partir de cada dato que el admin
  // agregue.
  function slugifyLabel(label, fallbackIndex) {
    var noAccents = (label || '').normalize ? label.normalize('NFD').replace(/[̀-ͯ]/g, '') : label;
    var words = noAccents.toLowerCase().split(/[^a-z0-9]+/).filter(function (w) {
      return w && !STOPWORDS[w];
    });
    if (!words.length) return 'dato' + (fallbackIndex + 1);
    return words[0] + words.slice(1).map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join('');
  }

  var pre, reduceMotion;

  function currentLang() {
    if (window.MPV && window.MPV.i18n) return window.MPV.i18n.getLang();
    return document.documentElement.lang === 'en' ? 'en' : 'es';
  }

  // Lee el par ES/EN que manda public/index.php (o admin-preview.js para la
  // vista previa) — data-role-es/-en, etc. Si el atributo del idioma pedido
  // no existe (versión vieja del HTML) cae de regreso al de "-es", nunca a
  // texto vacío.
  function attr(name, lang) {
    return pre.getAttribute(name + '-' + lang) || pre.getAttribute(name + '-es') || '';
  }

  function buildTokens(lang) {
    var role = attr('data-role', lang) || 'Desarrollador Web';
    var availability = attr('data-availability', lang) || 'Disponible';
    var facts = [];
    try { facts = JSON.parse(attr('data-facts', lang) || '[]'); } catch (e) {}

    var tokens = [
      { t: 'const ', c: 'var(--kw)' },
      { t: 'marco', c: 'var(--var)' },
      { t: ' = ', c: 'var(--text)' },
      { t: '{\n', c: 'var(--text)' },
      { t: '  rol', c: 'var(--num)' },
      { t: ': ', c: 'var(--text)' },
      { t: '"' + role + '"', c: 'var(--str)' },
      { t: ',\n', c: 'var(--text)' },
      { t: '  disponibilidad', c: 'var(--num)' },
      { t: ': ', c: 'var(--text)' },
      { t: '"' + availability + '"', c: 'var(--str)' }
    ];
    facts.forEach(function (fact, i) {
      var key = slugifyLabel(fact.label, i);
      tokens.push({ t: ',\n', c: 'var(--text)' });
      tokens.push({ t: '  ' + key, c: 'var(--num)' });
      tokens.push({ t: ': ', c: 'var(--text)' });
      tokens.push({ t: '"' + (fact.value || '') + '"', c: 'var(--str)' });
    });
    tokens.push({ t: '\n};', c: 'var(--text)' });
    return tokens;
  }

  function html(tokens, count) {
    var remaining = count, out = '';
    for (var i = 0; i < tokens.length; i++) {
      if (remaining <= 0) break;
      var tk = tokens[i];
      var slice = tk.t.slice(0, remaining).replace(/&/g, '&amp;').replace(/</g, '&lt;');
      out += '<span style="color:' + tk.c + '">' + slice + '</span>';
      remaining -= tk.t.length;
    }
    out += '<span class="hero__cursor">▌</span>';
    return out;
  }

  // animate=true solo tiene sentido en el primer renderizado de la página;
  // un cambio de idioma después redibuja de golpe (igual que el resto del
  // sitio no vuelve a "escribir letra por letra" al traducir, solo cambia el
  // texto).
  function render(lang, animate) {
    if (!pre) return;
    var tokens = buildTokens(lang);
    var total = tokens.reduce(function (n, tk) { return n + tk.t.length; }, 0);

    if (!animate || reduceMotion) {
      pre.innerHTML = html(tokens, total);
      return;
    }

    var n = 0;
    (function tick() {
      n = Math.min(total, n + 2);
      pre.innerHTML = html(tokens, n);
      if (n < total) setTimeout(tick, 28);
    })();
  }

  document.addEventListener('DOMContentLoaded', function () {
    pre = document.querySelector('[data-typewriter]');
    if (!pre) return;
    reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    render(currentLang(), true);
    document.addEventListener('mpv:langchange', function () { render(currentLang(), false); });
  });

  // admin-preview.js llama a esto después de reescribir los data-role-*/
  // data-availability-*/data-facts-* del <pre> tras cada edición del Hero,
  // para que el bloque "perfil.js" de la vista previa en vivo refleje el
  // cambio de inmediato — si no, se quedaría con lo que se dibujó la
  // primera vez que cargó el iframe, sin enterarse de ediciones después.
  window.MPVTypewriter = {
    render: function (lang) { render(lang || currentLang(), false); },
  };
})();
