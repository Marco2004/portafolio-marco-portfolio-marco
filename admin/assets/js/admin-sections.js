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
      var isActive = btn.getAttribute('data-section-btn') === name;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    var meta = SECTION_META[name] || ['', ''];
    document.querySelector('[data-section-title]').textContent = meta[0] ? t(meta[0]) : '';
    document.querySelector('[data-section-subtitle]').textContent = meta[1] ? t(meta[1]) : '';

    // El contenedor de las 7 secciones es el mismo (solo se esconde/muestra
    // cuál panel se ve, no se reconstruye) — sin esto, cambiar de sección
    // conservaba el scroll que traía la anterior, así que entrar a "Inicio"
    // desde más abajo en otra sección podía aterrizar a media página, con el
    // aviso de idioma y el título de la sección ya recortados por arriba en
    // vez de empezar limpio. .form-column tiene overflow-y:auto en la hoja
    // de estilos, pero .admin-shell solo pone min-height:100vh (no
    // height/max-height), así que en la práctica es la ventana la que
    // termina desplazándose, no ese contenedor — se resetean los dos para
    // cubrir cualquiera de las dos formas en que el navegador decida
    // desplazar el contenido.
    // El "scroll anchoring" del navegador (pensado para no saltar la vista
    // cuando cambia el contenido arriba) puede corregir un scrollTop=0
    // puesto aquí mismo apenas un instante después, en cuanto termina de
    // aplicarse el cambio real de qué panel está oculto — por eso se repite
    // en el siguiente frame, después de que ese reflow ya pasó.
    var formColumn = document.querySelector('.form-column');
    if (formColumn) formColumn.scrollTop = 0;
    window.scrollTo(0, 0);
    requestAnimationFrame(function () {
      if (formColumn) formColumn.scrollTop = 0;
      window.scrollTo(0, 0);
    });

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

  // Expuesta para que otros módulos puedan saltar a una sección a mano —
  // p. ej. admin-save.js, para llevar al admin directo a la fila con un
  // error de validación (nivel de habilidad eliminado) antes de guardar.
  window.MPVAdmin = window.MPVAdmin || {};
  window.MPVAdmin.showSection = showSection;

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

    // Cambio de tema instantáneo (data-theme se aplica directo, sin cross-fade
    // de colores) — mismo criterio que el sitio público, ver theme.js.
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', function () {
        var next = currentDashboardTheme() === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
        updateThemeToggleIcon(true);
        window.MPVAdmin.theme = next;
        window.MPVAdmin.notifyChange(true);
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
