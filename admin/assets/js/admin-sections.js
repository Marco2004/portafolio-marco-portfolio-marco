(function () {
  // Llaves del diccionario de admin-i18n.js — el texto real vive en
  // i18n/es.json e i18n/en.json bajo "admin.section.*".
  var SECTION_META = {
    hero: ['admin.section.hero.title', 'admin.section.hero.subtitle'],
    projects: ['admin.section.projects.title', 'admin.section.projects.subtitle'],
    skills: ['admin.section.skills.title', 'admin.section.skills.subtitle'],
    experience: ['admin.section.experience.title', 'admin.section.experience.subtitle'],
    education: ['admin.section.education.title', 'admin.section.education.subtitle'],
    contact: ['admin.section.contact.title', 'admin.section.contact.subtitle'],
    cv: ['admin.section.cv.title', 'admin.section.cv.subtitle'],
  };

  function t(key) {
    return window.MPVAdminI18n ? window.MPVAdminI18n.t(key) : key;
  }

  function showSection(name) {
    window.MPVAdmin.activeSection = name;

    document.querySelectorAll('[data-section-panel]').forEach(function (el) {
      el.hidden = el.getAttribute('data-section-panel') !== name;
    });
    document.querySelectorAll('[data-section-btn]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-section-btn') === name);
    });

    var meta = SECTION_META[name] || ['', ''];
    document.querySelector('[data-section-title]').textContent = meta[0] ? t(meta[0]) : '';
    document.querySelector('[data-section-subtitle]').textContent = meta[1] ? t(meta[1]) : '';

    window.MPVAdmin.notifyChange();
    document.dispatchEvent(new CustomEvent('mpv-admin:closedrawer'));
  }

  function updateEditLangUi() {
    var isEn = window.MPVAdmin.editLang === 'en';
    document.querySelectorAll('[data-edit-lang]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-edit-lang') === window.MPVAdmin.editLang);
    });
    var banner = document.querySelector('[data-edit-lang-banner]');
    if (banner) banner.classList.toggle('is-en', isEn);
    // "Editando: Español/English" y el idioma de INTERFAZ ahora son el mismo
    // valor (ver setEditLang() en admin-state.js), así que el nombre del
    // idioma dentro de la frase siempre corresponde al idioma de interfaz
    // activo — no hay caso donde difieran.
    var bannerText = document.querySelector('[data-edit-lang-banner-text]');
    if (bannerText) bannerText.textContent = isEn ? 'English' : 'Español';
    var bannerBefore = document.querySelector('[data-edit-lang-banner-before]');
    if (bannerBefore) bannerBefore.textContent = t('admin.editLangBanner.before');
    var bannerAfter = document.querySelector('[data-edit-lang-banner-after]');
    if (bannerAfter) {
      var langName = t('admin.langName.' + window.MPVAdmin.editLang);
      bannerAfter.textContent = t('admin.editLangBanner.after').replace('%LANG%', langName);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-section-btn]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showSection(btn.getAttribute('data-section-btn'));
      });
    });
    showSection('hero');

    var PREVIEW_OPEN_KEY = 'mpv_admin_preview_open';
    var previewPanel = document.querySelector('[data-preview-panel]');
    var previewToggleBtn = document.querySelector('[data-preview-toggle]');
    var previewToggleLabel = document.querySelector('[data-preview-toggle-label]');
    var previewToggleIcon = document.querySelector('[data-preview-toggle-icon]');

    var adminBody = document.querySelector('.admin-body');

    /**
     * Colapsar/expandir la vista previa anima el ancho a 0 en vez de
     * saltar con display:none (ver .preview-column.is-closed en
     * admin-layout.css) y recuerda la preferencia entre sesiones.
     */
    function setPreviewOpen(open, persist) {
      window.MPVAdmin.previewOpen = open;
      previewPanel.classList.toggle('is-closed', !open);
      previewPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
      if (previewToggleLabel) previewToggleLabel.textContent = open ? t('admin.preview.hide') : t('admin.preview.show');
      if (previewToggleIcon) previewToggleIcon.innerHTML = open ? window.MPVIcons.eyeOff : window.MPVIcons.eye;
      // Sin esto, .form-column sí crece (flex:1) al cerrar la vista previa,
      // pero .panel se queda con su max-width fijo (ver admin-forms.css) —
      // el espacio liberado queda vacío en vez de aprovecharse. Esta clase
      // relaja ese máximo solo mientras la vista previa está oculta.
      if (adminBody) adminBody.classList.toggle('preview-hidden', !open);
      if (persist) {
        try { localStorage.setItem(PREVIEW_OPEN_KEY, open ? '1' : '0'); } catch (e) {}
      }
    }

    var storedOpen = null;
    try { storedOpen = localStorage.getItem(PREVIEW_OPEN_KEY); } catch (e) {}
    setPreviewOpen(storedOpen === null ? true : storedOpen === '1', false);

    previewToggleBtn.addEventListener('click', function () {
      setPreviewOpen(!window.MPVAdmin.previewOpen, true);
    });

    document.querySelectorAll('[data-edit-lang]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.MPVAdmin.setEditLang(btn.getAttribute('data-edit-lang'));
      });
    });
    updateEditLangUi();
    document.addEventListener('mpv-admin:editlangchange', updateEditLangUi);

    /**
     * Tema propio del Dashboard: mientras no haya una elección manual
     * guardada, sigue el sistema operativo (resuelto antes de pintar por
     * theme_antiflash_script() en helpers.php). Este botón anula esa
     * elección de forma permanente (localStorage, clave "mpv_theme" — misma
     * clave que usa el sitio público, ver public/assets/js/theme.js) para
     * que la próxima visita respete el último tema elegido. Mismo diseño
     * (ícono + etiqueta con el modo actual) que el switch del sitio público,
     * ver admin.theme.toggle en i18n/*.json + .theme-toggle-btn en
     * admin-base.css. window.MPVAdmin.theme se expone para que
     * admin-preview.js pueda hacer que la vista previa en el iframe refleje
     * el mismo tema que ve el admin en el dashboard, en vez de un "tema del
     * visitante" separado.
     */
    var THEME_KEY = 'mpv_theme';
    var themeToggleBtn = document.querySelector('[data-dashboard-theme-toggle]');
    var themeToggleIcon = document.querySelector('[data-dashboard-theme-icon]');
    var themeToggleLabel = document.querySelector('[data-dashboard-theme-label]');

    function currentDashboardTheme() {
      return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    }

    // Mismo fundido (fade) de opacidad y misma duración (200ms) que usa el
    // cambio de idioma del sitio público (i18n.js) y el switch de tema del
    // sitio público (theme.js) — antes este ícono giraba/escalaba
    // (@keyframes themeIconSwap, ya eliminado) con una animación propia que
    // no tenía relación visual con el resto de las transiciones del sitio.
    var THEME_FADE_MS = 200;
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function fadeSwap(el, mutate, animate) {
      if (!el || !animate || reduceMotion) { if (el) mutate(); return; }
      var prevTransition = el.style.transition;
      el.style.transition = 'opacity ' + THEME_FADE_MS + 'ms ease';
      el.style.opacity = '0';
      setTimeout(function () {
        mutate();
        el.style.opacity = '1';
        setTimeout(function () {
          el.style.transition = prevTransition;
        }, THEME_FADE_MS);
      }, THEME_FADE_MS);
    }

    function updateThemeToggleIcon(animate) {
      fadeSwap(themeToggleLabel, function () {
        themeToggleLabel.textContent = currentDashboardTheme() === 'light'
          ? window.MPVAdminI18n.t('theme.light')
          : window.MPVAdminI18n.t('theme.dark');
      }, animate);
      if (!themeToggleIcon || !window.MPVIcons) return;
      fadeSwap(themeToggleIcon, function () {
        themeToggleIcon.innerHTML = currentDashboardTheme() === 'light' ? window.MPVIcons.sun : window.MPVIcons.moon;
      }, animate);
    }

    window.MPVAdmin.theme = currentDashboardTheme();

    // 1000ms — debe coincidir con --duration-theme en admin-base.css.
    // Mientras dura, .theme-transitioning (ver admin-base.css) hace que TODO
    // lo que cambia de color por el tema se anime a esta misma velocidad, en
    // vez de que cada elemento use la duración de su propia transición de
    // hover/foco (o ninguna).
    var THEME_TRANSITION_MS = 1000;
    var themeTransitionTimer = null;

    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', function () {
        var next = currentDashboardTheme() === 'light' ? 'dark' : 'light';
        if (!reduceMotion) {
          document.documentElement.classList.add('theme-transitioning');
          clearTimeout(themeTransitionTimer);
          themeTransitionTimer = setTimeout(function () {
            document.documentElement.classList.remove('theme-transitioning');
          }, THEME_TRANSITION_MS);
        }
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
        updateThemeToggleIcon(true);
        window.MPVAdmin.theme = next;
        window.MPVAdmin.notifyChange();
      });
      updateThemeToggleIcon(false);
    }

    // Al cambiar el idioma de interfaz (mismo botón "Editando:
    // Español/English", ver admin-i18n.js/admin-state.js), refrescar todo lo
    // que este archivo pinta a partir del diccionario y que no se resuelve
    // solo con el paso genérico [data-i18n] de admin-i18n.js: el título de
    // sección activa, la etiqueta del botón de vista previa y la frase del
    // banner de "Editando: ...".
    document.addEventListener('mpv-admin:langchange', function () {
      showSection(window.MPVAdmin.activeSection);
      setPreviewOpen(window.MPVAdmin.previewOpen, false);
      updateEditLangUi();
      updateThemeToggleIcon(false);
    });
  });
})();
