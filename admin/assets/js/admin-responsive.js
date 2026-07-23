(function () {
  var COLLAPSE_KEY = 'mpv_admin_sidebar_collapsed';

  document.addEventListener('DOMContentLoaded', function () {
    var sidebar = document.querySelector('[data-sidebar]');
    var overlay = document.querySelector('[data-drawer-overlay]');
    var toggleBtn = document.querySelector('[data-drawer-toggle]');

    function openDrawer() {
      sidebar.classList.add('is-open');
      overlay.hidden = false;
    }
    function closeDrawer(returnFocus) {
      sidebar.classList.remove('is-open');
      overlay.hidden = true;
      // Quien abrió el drawer con teclado no debería perder el foco en el
      // vacío al cerrarlo — regresa al botón que lo abrió.
      if (returnFocus) toggleBtn.focus();
    }

    toggleBtn.addEventListener('click', function () {
      if (sidebar.classList.contains('is-open')) {
        closeDrawer(false);
      } else {
        openDrawer();
      }
    });
    overlay.addEventListener('click', function () { closeDrawer(false); });
    document.addEventListener('mpv-admin:closedrawer', function () { closeDrawer(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sidebar.classList.contains('is-open')) {
        closeDrawer(true);
      }
    });

    // ---------- Contraer a solo-iconos (preferencia de escritorio) ----------
    var collapseBtn = document.querySelector('[data-sidebar-collapse]');
    var collapseIcon = document.querySelector('[data-sidebar-collapse-icon]');
    if (!collapseBtn) return;

    function collapseLabel(collapsed) {
      var key = collapsed ? 'admin.sidebar.expand' : 'admin.sidebar.collapse';
      var fallback = collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral';
      return window.MPVAdminI18n ? window.MPVAdminI18n.t(key) : fallback;
    }

    function setCollapsed(collapsed, persist) {
      sidebar.classList.toggle('is-collapsed', collapsed);
      collapseBtn.setAttribute('aria-label', collapseLabel(collapsed));
      collapseBtn.setAttribute('title', collapseLabel(collapsed));
      if (collapseIcon) collapseIcon.innerHTML = collapsed ? window.MPVIcons.chevronRight : window.MPVIcons.chevronLeft;
      if (persist) {
        try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch (e) {}
      }
    }

    var stored = null;
    try { stored = localStorage.getItem(COLLAPSE_KEY); } catch (e) {}
    setCollapsed(stored === '1', false);

    collapseBtn.addEventListener('click', function () {
      setCollapsed(!sidebar.classList.contains('is-collapsed'), true);
    });
    // El aria-label/title dependen del idioma de interfaz — sin esto se
    // quedaban en español al cambiar a inglés aunque el botón sí mostrara
    // "Collapse sidebar" en su estado inicial (data-i18n-title en
    // admin/index.php), porque esta función los sobrescribe en cada toggle.
    document.addEventListener('mpv-admin:langchange', function () {
      setCollapsed(sidebar.classList.contains('is-collapsed'), false);
    });
  });
})();
