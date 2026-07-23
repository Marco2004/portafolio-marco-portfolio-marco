<?php
require_once __DIR__ . '/../src/auth.php';
require_once __DIR__ . '/../src/Portfolio.php';
require_once __DIR__ . '/../src/helpers.php';

require_admin_gate();
require_login_page('login.php');

$pdo = get_pdo();
$data = Portfolio::getAll($pdo);

if (empty($_SESSION['csrf'])) {
    $_SESSION['csrf'] = bin2hex(random_bytes(16));
}
$csrf = $_SESSION['csrf'];
$adminI18n = [
    'es' => json_decode(file_get_contents(__DIR__ . '/../i18n/es.json'), true),
    'en' => json_decode(file_get_contents(__DIR__ . '/../i18n/en.json'), true),
];
?>
<!DOCTYPE html>
<html lang="es">
<head>
<script src="<?= asset_url('assets/js/theme-antiflash.js') ?>"></script>
<?php render_head_meta([
    'title' => 'Panel de administración — Portafolio Web',
    'titleI18nKey' => 'admin.pageTitle',
]) ?>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= asset_url('assets/css/normalize.css') ?>">
<link rel="stylesheet" href="<?= asset_url('assets/css/admin-base.css') ?>">
<link rel="stylesheet" href="<?= asset_url('assets/css/admin-layout.css') ?>">
<link rel="stylesheet" href="<?= asset_url('assets/css/admin-forms.css') ?>">
<link rel="stylesheet" href="<?= asset_url('assets/css/admin-preview.css') ?>">
<link rel="stylesheet" href="<?= asset_url('assets/css/admin-responsive.css') ?>">
</head>
<body>

<script id="admin-data" type="application/json"><?= json_encode_for_script(['data' => $data, 'csrf' => $csrf]) ?></script>
<script id="admin-i18n-data" type="application/json"><?= json_encode_for_script($adminI18n) ?></script>

<div class="admin-shell">
  <div class="drawer-overlay" data-drawer-overlay hidden></div>

  <aside class="sidebar" data-sidebar>
    <div class="sidebar__brand">
      <span class="sidebar__logo">M</span>
      <div class="sidebar__brand-text">
        <p class="sidebar__brand-title" data-i18n="admin.sidebar.brandTitle">Admin</p>
        <p class="sidebar__brand-subtitle" data-i18n="admin.sidebar.brandSubtitle">Portafolio Web</p>
      </div>
      <button type="button" class="sidebar__collapse-btn" data-sidebar-collapse data-i18n-title="admin.sidebar.collapse" data-i18n-aria="admin.sidebar.collapse" title="Contraer barra lateral" aria-label="Contraer barra lateral">
        <span data-sidebar-collapse-icon><?= icon('chevron-left') ?></span>
      </button>
    </div>
    <nav class="sidebar__nav" data-sidebar-nav role="tablist" aria-orientation="vertical" data-i18n-aria="admin.sidebar.navLabel" aria-label="Secciones del panel">
      <button type="button" class="sidebar__link" id="section-tab-hero" data-section-btn="hero" role="tab" aria-selected="true" aria-controls="panel-hero" data-i18n-title="admin.nav.hero" data-i18n-aria="admin.nav.hero" title="Inicio" aria-label="Inicio"><span class="sidebar__link-icon"><?= icon('home') ?></span><span class="sidebar__link-label" data-i18n="admin.nav.hero">Inicio</span></button>
      <button type="button" class="sidebar__link" id="section-tab-projects" data-section-btn="projects" role="tab" aria-selected="false" aria-controls="panel-projects" data-i18n-title="admin.nav.projects" data-i18n-aria="admin.nav.projects" title="Proyectos" aria-label="Proyectos"><span class="sidebar__link-icon"><?= icon('folder') ?></span><span class="sidebar__link-label" data-i18n="admin.nav.projects">Proyectos</span></button>
      <button type="button" class="sidebar__link" id="section-tab-skills" data-section-btn="skills" role="tab" aria-selected="false" aria-controls="panel-skills" data-i18n-title="admin.nav.skills" data-i18n-aria="admin.nav.skills" title="Habilidades" aria-label="Habilidades"><span class="sidebar__link-icon"><?= icon('brain') ?></span><span class="sidebar__link-label" data-i18n="admin.nav.skills">Habilidades</span></button>
      <button type="button" class="sidebar__link" id="section-tab-experience" data-section-btn="experience" role="tab" aria-selected="false" aria-controls="panel-experience" data-i18n-title="admin.nav.experience" data-i18n-aria="admin.nav.experience" title="Experiencia" aria-label="Experiencia"><span class="sidebar__link-icon"><?= icon('briefcase') ?></span><span class="sidebar__link-label" data-i18n="admin.nav.experience">Experiencia</span></button>
      <button type="button" class="sidebar__link" id="section-tab-education" data-section-btn="education" role="tab" aria-selected="false" aria-controls="panel-education" data-i18n-title="admin.nav.education" data-i18n-aria="admin.nav.education" title="Educación" aria-label="Educación"><span class="sidebar__link-icon"><?= icon('graduation-cap') ?></span><span class="sidebar__link-label" data-i18n="admin.nav.education">Educación</span></button>
      <button type="button" class="sidebar__link" id="section-tab-contact" data-section-btn="contact" role="tab" aria-selected="false" aria-controls="panel-contact" data-i18n-title="admin.nav.contact" data-i18n-aria="admin.nav.contact" title="Contacto" aria-label="Contacto"><span class="sidebar__link-icon"><?= icon('mail') ?></span><span class="sidebar__link-label" data-i18n="admin.nav.contact">Contacto</span></button>
      <button type="button" class="sidebar__link" id="section-tab-cv" data-section-btn="cv" role="tab" aria-selected="false" aria-controls="panel-cv" data-i18n-title="admin.nav.cv" data-i18n-aria="admin.nav.cv" title="CV" aria-label="CV"><span class="sidebar__link-icon"><?= icon('file-text') ?></span><span class="sidebar__link-label" data-i18n="admin.nav.cv">CV</span></button>
    </nav>
    <div class="sidebar__footer">
      <a href="../public/index.php" target="_blank" rel="noopener" data-i18n-title="admin.sidebar.viewSite" title="Ver sitio público" aria-label="Ver sitio público (se abre en una pestaña nueva)"><?= icon('external-link') ?><span class="sidebar__link-label" data-i18n="admin.sidebar.viewSite">Ver sitio público</span></a>
      <form method="post" action="logout.php" class="sidebar__logout-form">
        <input type="hidden" name="csrf_token" value="<?= e(csrf_field_token()) ?>">
        <button type="submit" class="is-danger" data-i18n-title="admin.sidebar.logout" data-i18n-aria="admin.sidebar.logout" title="Cerrar sesión" aria-label="Cerrar sesión"><?= icon('log-out') ?><span class="sidebar__link-label" data-i18n="admin.sidebar.logout">Cerrar sesión</span></button>
      </form>
    </div>
  </aside>

  <main class="admin-main">
    <div class="topbar">
      <div class="topbar__title-group">
        <button type="button" class="drawer-toggle" data-drawer-toggle data-i18n-aria="admin.openMenu" aria-label="Abrir menú"><?= icon('menu') ?></button>
        <div aria-live="polite">
          <p class="topbar__title" role="heading" aria-level="1" data-section-title>Inicio</p>
          <p class="topbar__subtitle" data-section-subtitle>Encabezado principal del sitio</p>
        </div>
      </div>
      <div class="topbar__actions">
        <button type="button" class="btn-secondary theme-toggle-btn" data-dashboard-theme-toggle data-i18n-aria="admin.theme.toggle" data-i18n-title="admin.theme.toggle" aria-label="Cambiar tema del panel" title="Cambiar tema del panel">
          <span class="theme-toggle-icon" data-dashboard-theme-icon><?= icon('moon') ?></span><span data-dashboard-theme-label>Oscuro</span>
        </button>
        <div class="edit-lang-toggle" data-edit-lang-toggle role="group" data-i18n-aria="admin.editLang.groupLabel" aria-label="Idioma de edición">
          <button type="button" data-edit-lang="es"><?= icon('globe') ?> Español</button>
          <button type="button" data-edit-lang="en"><?= icon('globe') ?> English</button>
        </div>
        <button type="button" class="btn-secondary" data-preview-toggle>
          <span data-preview-toggle-icon><?= icon('eye-off') ?></span>
          <span data-preview-toggle-label data-i18n="admin.preview.hide">Ocultar vista previa</span>
        </button>
        <button type="button" class="btn-save" data-save><?= icon('save') ?> <span data-i18n="admin.save">Guardar cambios</span></button>
      </div>
    </div>

    <div class="edit-lang-banner" data-edit-lang-banner>
      <span data-edit-lang-banner-before>Estás editando el contenido en</span> <strong data-edit-lang-banner-text>Español</strong> <span data-edit-lang-banner-after>— lo que escribas en los campos marcados como traducibles se guarda como la versión en español. Los campos que no cambian entre idiomas (URLs, tecnologías, fechas, datos de contacto) se ven igual en ambos modos.</span>
    </div>

    <div class="toast" data-toast hidden>
      <span class="toast__dot"></span>
      <span data-toast-text data-i18n="admin.toast.default">Cambios guardados correctamente</span>
    </div>

    <div class="admin-body">
      <div class="form-column">

        <!-- INICIO / HERO -->
        <section class="panel" id="panel-hero" role="tabpanel" aria-labelledby="section-tab-hero" data-section-panel="hero">
          <div class="card" data-collapsible-card>
            <button type="button" class="card__head" data-card-toggle aria-expanded="true"><span data-card-toggle-icon><?= icon('chevron-down') ?></span><p class="card__title" role="heading" aria-level="2" data-i18n="admin.hero.cardTitle">Encabezado (hero)</p></button>
            <div class="card__body">
            <div class="field-group">
              <div class="field"><label for="f-hero-name" data-i18n="admin.hero.name">Nombre completo</label><input class="input" type="text" id="f-hero-name" data-bind="hero.name"></div>
              <div class="field"><label for="f-hero-role"><span data-i18n="admin.hero.role">Rol / título</span> <span class="translatable-badge" data-i18n="admin.translatable">traducible</span></label><input class="input" type="text" id="f-hero-role" data-bind="hero.role" data-bind-en="hero.roleEn"></div>
              <div class="field"><label for="f-hero-desc"><span data-i18n="admin.hero.desc">Descripción</span> <span class="translatable-badge" data-i18n="admin.translatable">traducible</span></label><textarea class="input" rows="4" id="f-hero-desc" data-bind="hero.desc" data-bind-en="hero.descEn"></textarea></div>
              <div class="field"><label for="f-hero-avail"><span data-i18n="admin.hero.avail">Disponibilidad</span> <span class="translatable-badge" data-i18n="admin.translatable">traducible</span></label><input class="input" type="text" id="f-hero-avail" data-bind="hero.avail" data-bind-en="hero.availEn"></div>
              <div class="field">
                <label data-i18n="admin.color.indicatorLabel">Color del indicador</label>
                <div class="color-swatch" data-color-picker="hero.availColor">
                  <button type="button" class="color-swatch__btn" data-color-swatch data-i18n-title="admin.color.customize" data-i18n-aria="admin.color.customize" title="Personalizar color" aria-label="Personalizar color">
                    <span class="color-swatch__dot" data-color-dot></span>
                    <span data-color-label>Automático</span>
                  </button>
                  <input type="color" class="color-swatch__input" data-color-input data-default="#3fb950" tabindex="-1" aria-hidden="true">
                  <button type="button" class="color-swatch__reset" data-color-reset hidden data-i18n-title="admin.color.reset" data-i18n-aria="admin.color.reset" title="Volver al color automático" aria-label="Volver al color automático"><?= icon('revert') ?></button>
                </div>
                <p class="hint-text" data-i18n="admin.color.indicatorHint">Independiente del texto — elige cualquier color para el punto de estado.</p>
              </div>
            </div>
            </div>
          </div>
          <div class="card" data-collapsible-card>
            <button type="button" class="card__head" data-card-toggle aria-expanded="true"><span data-card-toggle-icon><?= icon('chevron-down') ?></span><p class="card__title" role="heading" aria-level="2" data-i18n="admin.hero.facts.cardTitle">Ficha rápida</p></button>
            <div class="card__body">
            <p class="hint-text" data-i18n="admin.hero.facts.hint">Agrega los datos que quieras mostrar junto al encabezado (Ubicación, Formación, Inglés, Nacionalidad...) — dato + valor, en el orden que quieras.</p>
            <div data-hero-facts-list></div>
            <button type="button" class="add-link" data-add-hero-fact data-i18n="admin.hero.facts.add">+ Agregar dato</button>
            </div>
          </div>
          <div class="card" data-collapsible-card>
            <button type="button" class="card__head" data-card-toggle aria-expanded="true"><span data-card-toggle-icon><?= icon('chevron-down') ?></span><p class="card__title" role="heading" aria-level="2" data-i18n="admin.hero.social.cardTitle">Redes sociales</p></button>
            <div class="card__body">
            <p class="hint-text" data-i18n="admin.hero.social.hint">Pega una URL o un correo electrónico y presiona Enter para agregarlo como botón — el ícono y el nombre se detectan solos (LinkedIn, GitHub, X, Instagram, Facebook, YouTube, WhatsApp, Telegram, TikTok, Dribbble, Email o un enlace genérico). Haz clic en la ✕ de un chip para quitarlo.</p>
            <div class="chip-input" data-social-links>
              <div class="chip-list" data-social-list></div>
              <input type="text" class="chip-input__text" data-social-text aria-label="URL o correo de red social" placeholder="https://linkedin.com/in/tu-usuario o tu@correo.com" inputmode="url" autocomplete="off">
            </div>
            </div>
          </div>
        </section>

        <!-- PROYECTOS -->
        <section class="panel" id="panel-projects" role="tabpanel" aria-labelledby="section-tab-projects" data-section-panel="projects" hidden>
          <div data-projects-list></div>
          <button type="button" class="add-btn" data-add-project data-i18n="admin.projects.add">+ Agregar proyecto</button>
        </section>

        <!-- HABILIDADES -->
        <section class="panel" id="panel-skills" role="tabpanel" aria-labelledby="section-tab-skills" data-section-panel="skills" hidden>
          <p class="hint-text" data-i18n="admin.skills.hint">Agrupa tus habilidades en categorías (por ejemplo "Lenguajes", "Frameworks", "Herramientas"). Puedes crear tantas categorías como quieras con el botón de abajo, y renombrar o borrar las que ya existen.</p>
          <div data-skills-list></div>
          <button type="button" class="add-btn" data-add-skill-category data-i18n="admin.skills.add">+ Agregar categoría</button>
        </section>

        <!-- EXPERIENCIA -->
        <section class="panel" id="panel-experience" role="tabpanel" aria-labelledby="section-tab-experience" data-section-panel="experience" hidden>
          <div data-experience-list></div>
          <button type="button" class="add-btn" data-add-experience data-i18n="admin.experience.add">+ Agregar experiencia</button>
        </section>

        <!-- EDUCACIÓN -->
        <section class="panel" id="panel-education" role="tabpanel" aria-labelledby="section-tab-education" data-section-panel="education" hidden>
          <div data-education-entries-list></div>
          <button type="button" class="add-btn" data-add-education-entry data-i18n="admin.education.add">+ Agregar título</button>
          <div class="card" data-collapsible-card>
            <button type="button" class="card__head" data-card-toggle aria-expanded="true"><span data-card-toggle-icon><?= icon('chevron-down') ?></span><p class="card__title" role="heading" aria-level="2"><span data-i18n="admin.education.langs.cardTitle">Idiomas</span> <span class="translatable-badge" data-i18n="admin.translatable">traducible</span></p></button>
            <div class="card__body">
            <div data-languages-list></div>
            <button type="button" class="add-link" data-add-language data-i18n="admin.education.langs.add">+ Agregar idioma</button>
            </div>
          </div>
          <div class="card" data-collapsible-card>
            <button type="button" class="card__head" data-card-toggle aria-expanded="true"><span data-card-toggle-icon><?= icon('chevron-down') ?></span><p class="card__title" role="heading" aria-level="2" data-i18n="admin.education.certs.cardTitle">Certificaciones</p></button>
            <div class="card__body">
            <div data-certs-list></div>
            <button type="button" class="add-link" data-add-cert data-i18n="admin.education.certs.add">+ Agregar certificación</button>
            </div>
          </div>
        </section>

        <!-- CONTACTO -->
        <section class="panel" id="panel-contact" role="tabpanel" aria-labelledby="section-tab-contact" data-section-panel="contact" hidden>
          <div class="card" data-collapsible-card>
            <button type="button" class="card__head" data-card-toggle aria-expanded="true"><span data-card-toggle-icon><?= icon('chevron-down') ?></span><p class="card__title" role="heading" aria-level="2" data-i18n="admin.contact.cardTitle">Medios de contacto</p></button>
            <div class="card__body">
            <p class="hint-text" data-i18n="admin.contact.hint">Agrega los medios que quieras mostrar (Email, Teléfono, Ubicación, Discord...) — si el valor se ve como correo o teléfono, en el portafolio se enlaza solo.</p>
            <div data-contacts-list></div>
            <button type="button" class="add-link" data-add-contact data-i18n="admin.contact.add">+ Agregar contacto</button>
            </div>
          </div>
          <div class="card" data-collapsible-card>
            <button type="button" class="card__head" data-card-toggle aria-expanded="true"><span data-card-toggle-icon><?= icon('chevron-down') ?></span><p class="card__title" role="heading" aria-level="2" data-i18n="admin.contact.badgeCardTitle">Disponibilidad</p></button>
            <div class="card__body">
            <div class="field-group">
              <div class="field"><label for="f-contact-badge"><span data-i18n="admin.contact.badge">Mensaje de disponibilidad</span> <span class="translatable-badge" data-i18n="admin.translatable">traducible</span></label><input class="input" type="text" id="f-contact-badge" data-bind="contact.badge" data-bind-en="contact.badgeEn"></div>
              <div class="field">
                <label data-i18n="admin.color.indicatorLabel">Color del indicador</label>
                <div class="color-swatch" data-color-picker="contact.badgeColor">
                  <button type="button" class="color-swatch__btn" data-color-swatch data-i18n-title="admin.color.customize" data-i18n-aria="admin.color.customize" title="Personalizar color" aria-label="Personalizar color">
                    <span class="color-swatch__dot" data-color-dot></span>
                    <span data-color-label>Automático</span>
                  </button>
                  <input type="color" class="color-swatch__input" data-color-input data-default="#3fb950" tabindex="-1" aria-hidden="true">
                  <button type="button" class="color-swatch__reset" data-color-reset hidden data-i18n-title="admin.color.reset" data-i18n-aria="admin.color.reset" title="Volver al color automático" aria-label="Volver al color automático"><?= icon('revert') ?></button>
                </div>
                <p class="hint-text" data-i18n="admin.color.indicatorHint">Independiente del texto — elige cualquier color para el punto de estado.</p>
              </div>
              <p class="hint-text" data-i18n="admin.contact.badgeHint">Esta sección es independiente de las redes sociales de Inicio — si quieres mostrar LinkedIn, GitHub u otra red también aquí, agrégala como un contacto más arriba.</p>
            </div>
            </div>
          </div>
        </section>

        <!-- CV -->
        <section class="panel" id="panel-cv" role="tabpanel" aria-labelledby="section-tab-cv" data-section-panel="cv" hidden>
          <div class="card" data-collapsible-card>
            <button type="button" class="card__head" data-card-toggle aria-expanded="true"><span data-card-toggle-icon><?= icon('chevron-down') ?></span><p class="card__title" role="heading" aria-level="2" data-i18n="admin.cv.cardTitle">CV</p></button>
            <div class="card__body">
            <div class="cv-current">
              <span class="cv-current__icon"><?= icon('file-text') ?></span>
              <div class="cv-current__body">
                <p class="cv-current__name" data-i18n="admin.cv.name">Formato único, generado en automático</p>
                <p class="cv-current__hint" data-i18n="admin.cv.hint">No se sube ningún archivo aquí — el CV siempre se genera con este mismo formato (perfil, experiencia, educación, habilidades, certificaciones e idiomas), tomando siempre los últimos cambios que guardes en las demás pestañas.</p>
              </div>
              <a class="btn-secondary" href="../public/index.php?cv=1" target="_blank" rel="noopener" data-i18n="admin.cv.viewLink">Ver / descargar CV</a>
            </div>
            <p class="hint-text cv-current__footnote" data-i18n="admin.cv.footnote">"Ver / descargar CV" abre el sitio público con la vista previa del CV lista para imprimir o guardar como PDF desde ahí.</p>
            </div>
          </div>
          <div class="card" data-collapsible-card>
            <button type="button" class="card__head" data-card-toggle aria-expanded="true"><span data-card-toggle-icon><?= icon('chevron-down') ?></span><p class="card__title" role="heading" aria-level="2" data-i18n="admin.cv.linkCardTitle">Link del portafolio</p></button>
            <div class="card__body">
            <div class="field-group">
              <div class="field"><label for="f-cv-portfolio-url"><span data-i18n="admin.cv.portfolioUrl">Link del portafolio</span></label><input class="input" type="url" id="f-cv-portfolio-url" placeholder="https://tu-dominio.com" data-bind="contact.portfolioUrl"></div>
              <p class="hint-text" data-i18n="admin.cv.portfolioUrlHint">Se muestra junto a los demás datos de contacto del CV. Déjalo con el valor de ejemplo hasta que despliegues el sitio y tengas el dominio definitivo — luego actualízalo aquí.</p>
            </div>
            </div>
          </div>
        </section>

      </div>

      <aside class="preview-column" data-preview-panel>
        <div class="preview-resize-handle" data-preview-resize role="separator" aria-orientation="vertical" data-i18n-aria="admin.preview.resizeHandle" aria-label="Cambiar el ancho de la vista previa" tabindex="0"></div>
        <div class="preview-header-row">
          <p class="preview-header"><span class="dot"></span><span data-i18n="admin.preview.header">Vista previa en vivo — el sitio real</span></p>
          <button type="button" class="preview-expand-btn" data-preview-expand data-i18n-aria="admin.preview.expand" aria-label="Ampliar vista previa">
            <span data-preview-expand-icon><?= icon('expand') ?></span>
          </button>
        </div>
        <div class="preview-frame-wrap">
          <iframe class="preview-frame" data-preview-frame title="Vista previa del sitio público" loading="eager"></iframe>
          <script src="<?= asset_url('assets/js/admin-preview-init.js') ?>"></script>
        </div>
      </aside>
    </div>
  </main>
</div>

<!-- defer en los 20: ya están al final de <body>, así que el orden de
     ejecución entre ellos no cambia (defer los mantiene en orden de
     documento, igual que ahora) — la diferencia es que el navegador puede
     empezar a descargar los 20 en paralelo desde que el parser HTML
     arranca, en vez de esperar a llegar a cada <script> uno por uno para
     recién ahí pedirlo. admin-preview-init.js (más arriba, junto al
     <iframe>) se deja fuera a propósito: usa document.currentScript +
     previousElementSibling para encontrar el iframe, algo que depende de
     que ese script corra sin defer/async justo donde está. -->
<script defer src="<?= asset_url('assets/js/admin-escape.js') ?>"></script>
<script defer src="<?= asset_url('assets/js/admin-icons.js') ?>"></script>
<script defer src="<?= asset_url('assets/js/admin-i18n.js') ?>"></script>
<script defer src="<?= asset_url('assets/js/admin-state.js') ?>"></script>
<script defer src="<?= asset_url('assets/js/admin-sections.js') ?>"></script>
<script defer src="<?= asset_url('assets/js/admin-preview.js') ?>"></script>
<script defer src="<?= asset_url('assets/js/admin-preview-highlight.js') ?>"></script>
<script defer src="<?= asset_url('assets/js/admin-preview-resize.js') ?>"></script>
<script defer src="<?= asset_url('assets/js/admin-sortable.js') ?>"></script>
<script defer src="<?= asset_url('assets/js/admin-chip-input.js') ?>"></script>
<script defer src="<?= asset_url('assets/js/admin-social-links.js') ?>"></script>
<script defer src="<?= asset_url('assets/js/admin-datepicker.js') ?>"></script>
<script defer src="<?= asset_url('assets/js/admin-confirm-dialog.js') ?>"></script>
<script defer src="<?= asset_url('assets/js/admin-color-picker.js') ?>"></script>
<script defer src="<?= asset_url('assets/js/admin-combo.js') ?>"></script>
<script defer src="<?= asset_url('assets/js/admin-card-collapse.js') ?>"></script>
<script defer src="<?= asset_url('assets/js/admin-forms.js') ?>"></script>
<script defer src="<?= asset_url('assets/js/admin-upload.js') ?>"></script>
<script defer src="<?= asset_url('assets/js/admin-save.js') ?>"></script>
<script defer src="<?= asset_url('assets/js/admin-draft.js') ?>"></script>
<script defer src="<?= asset_url('assets/js/admin-responsive.js') ?>"></script>
</body>
</html>
