/**
 * Redes sociales del Inicio del dashboard: lista libre de URLs con la misma
 * UX que las habilidades (escribir + Enter agrega, click en × quita), pero
 * en vez de guardarse como texto separado por comas se guarda como
 * window.MPVAdmin.state.socialLinks (array de {url}) porque cada chip
 * necesita mostrar un ícono de plataforma detectado por dominio.
 *
 * El mapa de dominios→ícono es el mismo que detect_social_platform() en
 * src/helpers.php (usado ahí para el sitio público) — se repite aquí en JS
 * por la misma razón que admin-icons.js ya repite algunos de los íconos de
 * helpers.php::icon(): esta lista se dibuja en el navegador al escribir,
 * antes de que el servidor intervenga.
 */
(function () {
  function svg(inner) {
    return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }

  var ICONS = {
    linkedin: svg('<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r=".9" fill="currentColor" stroke="none"/><path d="M8 11.2V17"/><path d="M13 17v-4a2 2 0 0 1 4 0v4"/><path d="M13 17v-5.8"/>'),
    'twitter-x': svg('<path d="M4.5 4.5l15 15M19.5 4.5l-15 15"/>'),
    instagram: svg('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/>'),
    youtube: svg('<rect x="2.5" y="6" width="19" height="12" rx="4"/><path d="M10.5 9.7v4.6l4.3-2.3Z" fill="currentColor" stroke="none"/>'),
    whatsapp: svg('<path d="M12 3a9 9 0 0 0-7.75 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z"/><path d="M8.6 9.1c0 4 2.4 6.4 6.4 6.4.5 0 1-.4 1.1-.9l.1-.7c.1-.4-.1-.7-.4-.9l-1.3-.7c-.3-.2-.6-.1-.9.1l-.4.4c-.9-.5-1.6-1.2-2.1-2.1l.4-.4c.2-.3.3-.6.1-.9l-.7-1.3c-.2-.3-.5-.5-.9-.4l-.7.1c-.5.1-.9.6-.7 1.3Z" fill="currentColor" stroke="none"/>'),
    telegram: svg('<circle cx="12" cy="12" r="9.3"/><path d="M6.3 12.1l11.2-4.6-2.9 11.3-3.4-3.9-2.6 1.9Z" fill="currentColor" stroke="none"/>'),
    tiktok: svg('<path d="M13.8 3v10.8a3.3 3.3 0 1 1-2.8-3.3"/><path d="M13.8 3c.3 2.3 2 4 4.3 4.3"/>'),
    facebook: svg('<path d="M15 8.2h2V4.3h-2.2c-2.7 0-4.3 1.6-4.3 4.3v2.2H8v3.8h2.5V21h3.8v-6.4H17l.4-3.8h-3.1V8.9c0-.4.3-.7.7-.7Z" fill="currentColor" stroke="none"/>'),
    'github-mark': svg('<path d="M12 2.2c-5.5 0-10 4.5-10 10 0 4.4 2.9 8.2 6.8 9.5.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.7.4-1.1.6-1.4-2.2-.2-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.2-.5-1.3.1-2.7 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .6 1.4.2 2.5.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.8-4.6 5 .4.3.7.9.7 1.9v2.7c0 .3.2.6.7.5 4-1.3 6.8-5.1 6.8-9.5 0-5.5-4.5-10-10-10Z" fill="currentColor" stroke="none"/>'),
    dribbble: svg('<circle cx="12" cy="12" r="9"/><path d="M4.2 9.6c4 1.2 8.6 1.2 15.1-1.1"/><path d="M6 19.2c1.9-5.1 5-9.2 12.1-10.8"/><path d="M12.2 3.1c3 4.1 4.5 8.3 3.9 17.4"/>'),
    link: svg('<path d="M9.5 14.5 14.5 9.5"/><path d="M11 6.5l1-1a4 4 0 0 1 5.5 5.5l-1.5 1.5"/><path d="M13 17.5l-1 1a4 4 0 0 1-5.5-5.5l1.5-1.5"/>'),
    email: svg('<rect x="3" y="5.5" width="18" height="13" rx="1.5"/><path d="m4 7 8 6 8-6"/>')
  };

  var DOMAIN_MAP = {
    'linkedin.com': { icon: 'linkedin', label: 'LinkedIn' },
    'github.com': { icon: 'github-mark', label: 'GitHub' },
    'twitter.com': { icon: 'twitter-x', label: 'X (Twitter)' },
    'x.com': { icon: 'twitter-x', label: 'X (Twitter)' },
    'instagram.com': { icon: 'instagram', label: 'Instagram' },
    'facebook.com': { icon: 'facebook', label: 'Facebook' },
    'fb.com': { icon: 'facebook', label: 'Facebook' },
    'youtube.com': { icon: 'youtube', label: 'YouTube' },
    'youtu.be': { icon: 'youtube', label: 'YouTube' },
    'wa.me': { icon: 'whatsapp', label: 'WhatsApp' },
    'whatsapp.com': { icon: 'whatsapp', label: 'WhatsApp' },
    't.me': { icon: 'telegram', label: 'Telegram' },
    'telegram.org': { icon: 'telegram', label: 'Telegram' },
    'tiktok.com': { icon: 'tiktok', label: 'TikTok' },
    'dribbble.com': { icon: 'dribbble', label: 'Dribbble' }
  };

  var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  function detectPlatform(url) {
    if (/^mailto:/i.test(url)) {
      return { icon: 'email', label: 'Email' };
    }
    var host = '';
    try {
      host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch (e) {
      return { icon: 'link', label: url };
    }
    return DOMAIN_MAP[host] || { icon: 'link', label: host || url };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Acepta http(s)://, mailto: y una dirección de correo suelta (se
  // normaliza a mailto: en normalizeUrl antes de guardarse).
  function isHttpUrl(value) {
    var v = value.trim();
    return /^https?:\/\/.+/i.test(v) || /^mailto:.+/i.test(v) || EMAIL_RE.test(v);
  }

  function normalizeUrl(value) {
    var v = value.trim();
    if (EMAIL_RE.test(v)) return 'mailto:' + v;
    return v;
  }

  function enhance() {
    var wrap = document.querySelector('[data-social-links]');
    if (!wrap) return;
    var list = wrap.querySelector('[data-social-list]');
    var textInput = wrap.querySelector('[data-social-text]');
    var state = window.MPVAdmin.state;
    state.socialLinks = state.socialLinks || [];

    function render() {
      list.innerHTML = state.socialLinks.map(function (link, i) {
        var platform = detectPlatform(link.url);
        return '<span class="chip-tag">' +
          '<span class="chip-tag__icon">' + (ICONS[platform.icon] || ICONS.link) + '</span>' +
          escapeHtml(platform.label) +
          '<button type="button" class="chip-tag__remove" data-i="' + i + '" aria-label="Quitar ' + escapeHtml(platform.label) + '">&times;</button></span>';
      }).join('');
    }

    function addUrl(raw) {
      var url = raw.trim();
      if (!isHttpUrl(url)) {
        window.MPVAdmin.showToast && window.MPVAdmin.showToast('Pega una URL completa (empieza con https://) o un correo electrónico', true);
        return;
      }
      state.socialLinks.push({ url: normalizeUrl(url) });
      window.MPVAdmin.notifyChange();
      render();
    }

    textInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (textInput.value.trim()) {
          addUrl(textInput.value);
          textInput.value = '';
        }
      }
    });
    textInput.addEventListener('blur', function () {
      if (textInput.value.trim()) {
        addUrl(textInput.value);
        textInput.value = '';
      }
    });
    textInput.addEventListener('paste', function (e) {
      var pasted = (e.clipboardData || window.clipboardData).getData('text');
      if (isHttpUrl(pasted)) {
        e.preventDefault();
        addUrl(pasted);
      }
    });

    list.addEventListener('click', async function (e) {
      var btn = e.target.closest('[data-i]');
      if (!btn) return;
      var chip = btn.closest('.chip-tag');
      if (window.MPVAdmin.dustDisintegrate) await window.MPVAdmin.dustDisintegrate(chip);
      state.socialLinks.splice(Number(btn.dataset.i), 1);
      window.MPVAdmin.notifyChange();
      render();
    });

    render();
  }

  document.addEventListener('DOMContentLoaded', enhance);
  window.MPVSocialLinks = { detectPlatform: detectPlatform };
})();
