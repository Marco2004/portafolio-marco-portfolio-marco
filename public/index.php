<?php
require_once __DIR__ . '/../src/db.php';
require_once __DIR__ . '/../src/Portfolio.php';
require_once __DIR__ . '/../src/Cv.php';

$pdo = get_pdo();
$data = Portfolio::getAll($pdo);

$i18n = [
    'es' => json_decode(file_get_contents(__DIR__ . '/../i18n/es.json'), true),
    'en' => json_decode(file_get_contents(__DIR__ . '/../i18n/en.json'), true),
];

// La vista previa en vivo del dashboard (admin/index.php) carga esta misma
// página dentro de un <iframe> con ?preview=1 — ahí el header/nav del sitio
// no aporta nada (no hay a dónde navegar dentro del panel) y solo resta
// espacio vertical al área realmente útil de la vista previa.
$isPreview = isset($_GET['preview']);

// En modo vista previa, admin/index.php arma el <iframe> con el tema ya
// resuelto del propio dashboard (ver admin-preview.js) por query string —
// así esta página nace con el data-theme correcto desde el primer byte, y
// fullSync() lo vuelve a corregir en caliente si cambia después sin recargar
// el iframe. Fuera de preview no hay default de base de datos: el servidor
// no sabe qué prefiere el sistema operativo del visitante, así que renderiza
// un valor base ("dark") que el script anti-flash de abajo corrige de
// inmediato, antes de pintar, usando localStorage (anulación manual guardada
// de forma permanente, ver theme.js) o prefers-color-scheme real del
// navegador. El idioma no necesita este mismo mecanismo de query string:
// siempre nace en "es" y, si corresponde, i18n.js lo corrige de inmediato en
// DOMContentLoaded (o fullSync lo hace dentro del iframe de vista previa)
// sin depender de la URL.
if ($isPreview && in_array($_GET['theme'] ?? '', ['light', 'dark'], true)) {
    $theme = $_GET['theme'];
} else {
    $theme = 'dark';
}
$lang = 'es';
$hero = $data['hero'];
$heroFacts = $data['heroFacts'];
$contact = $data['contact'];
$education = $data['education'];
$educationEntries = $data['educationEntries'];

$flagship = null;
$otherProjects = [];
foreach ($data['projects'] as $p) {
    if ($p['flagship'] && $flagship === null) {
        $flagship = $p;
    } else {
        $otherProjects[] = $p;
    }
}

function project_domain(string $title): string {
    $slug = strtolower(trim(preg_replace('/[^a-z0-9]+/i', '-', $title), '-'));
    return $slug !== '' ? $slug : 'proyecto';
}

$socialLinks = $data['socialLinks'];
$githubLink = null;
foreach ($socialLinks as $link) {
    $platform = detect_social_platform($link['url']);
    if ($platform['icon'] === 'github-mark') {
        $githubLink = safe_social_url($link['url']);
        break;
    }
}
?>
<!DOCTYPE html>
<html lang="<?= e($lang) ?>" data-theme="<?= e($theme) ?>">
<head>
<?php if (!$isPreview): ?>
<script src="<?= asset_url('assets/js/theme-antiflash.js') ?>"></script>
<?php endif; ?>
<!-- En vista previa (?preview=1) el tema ya viene forzado por query string
     desde admin/index.php (ver $theme arriba) — el script de arriba se
     omite a propósito para que nunca reevalúe/corrija el data-theme con el
     localStorage o prefers-color-scheme reales del navegador del admin. -->
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#1f6feb">
<title><?= e($hero['name']) ?> — <?= e(t($hero['role'], $hero['roleEn'], $lang)) ?></title>
<meta name="description" content="Portafolio de <?= e($hero['name']) ?>, <?= e(t($hero['role'], $hero['roleEn'], $lang)) ?>. Proyectos, experiencia y CV descargable.">
<meta name="author" content="<?= e($hero['name']) ?>">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%231f6feb'/%3E%3Ctext x='50' y='68' font-size='58' font-family='monospace' fill='white' text-anchor='middle'%3E%3C/%3E%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= asset_url('assets/css/normalize.css') ?>">
<link rel="stylesheet" href="<?= asset_url('assets/css/variables.css') ?>">
<link rel="stylesheet" href="<?= asset_url('assets/css/base.css') ?>">
<link rel="stylesheet" href="<?= asset_url('assets/css/nav.css') ?>">
<link rel="stylesheet" href="<?= asset_url('assets/css/hero.css') ?>">
<link rel="stylesheet" href="<?= asset_url('assets/css/projects.css') ?>">
<link rel="stylesheet" href="<?= asset_url('assets/css/skills.css') ?>">
<link rel="stylesheet" href="<?= asset_url('assets/css/experience.css') ?>">
<link rel="stylesheet" href="<?= asset_url('assets/css/education-contact.css') ?>">
<link rel="stylesheet" href="<?= asset_url('assets/css/footer.css') ?>">
<link rel="stylesheet" href="<?= asset_url('assets/css/cv-overlay.css') ?>">
<link rel="stylesheet" href="<?= asset_url('assets/css/animations.css') ?>">
<link rel="stylesheet" href="<?= asset_url('assets/css/responsive.css') ?>">
<script src="<?= asset_url('assets/js/mark-js-enabled.js') ?>"></script>
</head>
<body>

<script type="application/json" id="i18n-data"><?= json_encode_for_script($i18n) ?></script>

<div class="portfolio-main">

  <!-- NAV (oculto dentro de la vista previa del dashboard: ver $isPreview) -->
  <?php if (!$isPreview): ?>
  <nav class="nav no-print">
    <div class="nav__inner">
      <a href="#top" class="nav__brand">
        <span class="nav__logo">M</span>
        <span class="nav__brand-text" data-i18n="nav.brand"><?= e($i18n[$lang]['nav.brand']) ?></span>
      </a>
      <div class="nav__links">
        <a href="#proyectos" class="nav__link" data-i18n="nav.projects"><?= e($i18n[$lang]['nav.projects']) ?></a>
        <a href="#stack" class="nav__link" data-i18n="nav.skills"><?= e($i18n[$lang]['nav.skills']) ?></a>
        <a href="#experiencia" class="nav__link" data-i18n="nav.experience"><?= e($i18n[$lang]['nav.experience']) ?></a>
        <a href="#formacion" class="nav__link" data-i18n="nav.education"><?= e($i18n[$lang]['nav.education']) ?></a>
        <a href="#contacto" class="nav__link" data-i18n="nav.contact"><?= e($i18n[$lang]['nav.contact']) ?></a>
        <button type="button" class="nav__icon-btn" data-lang-toggle title="Español / English" aria-label="Cambiar idioma">
          <span class="lang-toggle-dot">◍</span><span data-lang-label><?= $lang === 'en' ? 'ES' : 'EN' ?></span>
        </button>
        <button type="button" class="nav__icon-btn" data-theme-toggle title="Cambiar tema claro/oscuro" aria-label="Cambiar tema">
          <span class="theme-toggle-icon" data-theme-icon></span><span data-theme-label><?= $theme === 'dark' ? e($i18n[$lang]['theme.dark']) : e($i18n[$lang]['theme.light']) ?></span>
        </button>
        <button type="button" class="btn btn-primary nav__cv-btn" data-cv-open data-i18n="nav.cv"><?= e($i18n[$lang]['nav.cv']) ?></button>
      </div>
    </div>
  </nav>
  <?php endif; ?>

  <!-- HERO -->
  <header id="top" class="hero">
    <p class="hero__badge">
      <span class="hero__badge-dot"></span>
      <span<?= dyn_attrs($hero['avail'], $hero['availEn']) ?>><?= e(t($hero['avail'], $hero['availEn'], $lang)) ?></span>
    </p>
    <h1 class="hero__title"><?= e($hero['name']) ?></h1>
    <p class="hero__role"<?= dyn_attrs($hero['role'], $hero['roleEn']) ?>><?= e(t($hero['role'], $hero['roleEn'], $lang)) ?></p>
    <p class="hero__desc"<?= dyn_attrs($hero['desc'], $hero['descEn']) ?>><?= e(t($hero['desc'], $hero['descEn'], $lang)) ?></p>

    <div class="hero__grid">
      <div class="hero__facts">
        <?php foreach ($heroFacts as $fact): ?>
          <div class="hero__fact">
            <p class="hero__fact-label"<?= dyn_attrs($fact['label'], $fact['labelEn']) ?>><?= e(t($fact['label'], $fact['labelEn'], $lang)) ?></p>
            <p class="hero__fact-value"<?= dyn_attrs($fact['value'], $fact['valueEn']) ?>><?= e(t($fact['value'], $fact['valueEn'], $lang)) ?></p>
          </div>
        <?php endforeach; ?>
      </div>

      <div class="hero__code">
        <div class="hero__code-bar">
          <span class="traffic-lights"><span></span><span></span><span></span></span>
          <span class="hero__code-filename">perfil.js</span>
        </div>
        <div class="hero__code-body">
          <div class="hero__code-lines">1<br>2<br>3<br>4<br>5<br>6<br>7<br>8<br>9</div>
          <?php
          // "perfil.js" (el bloque con estilo de código) traía el rol,
          // disponibilidad y fichas ya resueltos a un solo idioma (el $lang
          // fijo de esta página, siempre "es") y typewriter.js los escribía
          // una sola vez al cargar — nunca se enteraba de un cambio de
          // idioma real (i18n.js corre 100% en el cliente). Ahora se manda
          // el par ES/EN de cada dato (con el mismo fallback de t(): si
          // falta la traducción al inglés, se usa el español en vez de
          // dejarlo vacío — igual que dyn_attrs() en helpers.php) y
          // typewriter.js elige cuál mostrar y se vuelve a dibujar solo con
          // el evento mpv:langchange.
          $factsEs = array_map(fn($f) => ['label' => $f['label'] ?? '', 'value' => $f['value'] ?? ''], $heroFacts);
          $factsEn = array_map(fn($f) => [
              'label' => t($f['label'], $f['labelEn'], 'en'),
              'value' => t($f['value'], $f['valueEn'], 'en'),
          ], $heroFacts);
          ?>
          <pre class="hero__code-pre" data-typewriter
            data-role-es="<?= e($hero['role']) ?>"
            data-role-en="<?= e(t($hero['role'], $hero['roleEn'], 'en')) ?>"
            data-availability-es="<?= e($hero['avail']) ?>"
            data-availability-en="<?= e(t($hero['avail'], $hero['availEn'], 'en')) ?>"
            data-facts-es="<?= e(json_encode($factsEs)) ?>"
            data-facts-en="<?= e(json_encode($factsEn)) ?>"></pre>
        </div>
      </div>
    </div>

    <div class="hero__cta">
      <?php foreach ($socialLinks as $link): $url = safe_social_url($link['url']); if ($url === '') continue; $platform = detect_social_platform($url); ?>
        <a href="<?= e($url) ?>" target="_blank" rel="noopener" class="btn btn-ghost"><?= e($platform['label']) ?> ↗</a>
      <?php endforeach; ?>
    </div>
  </header>

  <!-- PROYECTOS -->
  <section id="proyectos" class="section">
    <div data-reveal>
      <p class="section-kicker" data-i18n="p.kick"><?= e($i18n[$lang]['p.kick']) ?></p>
      <h2 class="section-title" data-i18n="p.title"><?= e($i18n[$lang]['p.title']) ?></h2>
      <p class="section-intro" data-i18n="p.intro"><?= e($i18n[$lang]['p.intro']) ?></p>
    </div>

    <?php if ($flagship): ?>
    <article class="flagship" data-reveal>
      <div class="flagship__bar">
        <span class="flagship__bar-label" data-i18n="fp.kick"><?= e($i18n[$lang]['fp.kick']) ?></span>
      </div>
      <div class="flagship__body">
        <?php if ($flagship['image']): ?>
          <img class="flagship__image" src="uploads/projects/<?= e($flagship['image']) ?>" alt="<?= e($flagship['title']) ?>">
        <?php else: ?>
          <div class="flagship__image image-drop"><div class="image-drop__placeholder">Sin captura todavía</div></div>
        <?php endif; ?>
        <div class="flagship__content">
          <div>
            <h3 class="flagship__title"><?= e($flagship['title']) ?></h3>
            <p class="flagship__subtitle"<?= dyn_attrs($flagship['what'], $flagship['whatEn']) ?>><?= e(t($flagship['what'], $flagship['whatEn'], $lang)) ?></p>
            <?php if ($flagship['stack']): ?>
              <div class="flagship__stack">
                <?php foreach ($flagship['stack'] as $tech): ?>
                  <span class="chip"><?= e($tech) ?></span>
                <?php endforeach; ?>
              </div>
            <?php endif; ?>
          </div>
          <div class="flagship__narrative">
            <div>
              <p class="flagship__narrative-label" data-i18n="fp.problem.l"><?= e($i18n[$lang]['fp.problem.l']) ?></p>
              <p class="flagship__narrative-text"<?= dyn_attrs($flagship['problem'], $flagship['problemEn']) ?>><?= e(t($flagship['problem'], $flagship['problemEn'], $lang)) ?></p>
            </div>
            <div>
              <p class="flagship__narrative-label" data-i18n="fp.decision.l"><?= e($i18n[$lang]['fp.decision.l']) ?></p>
              <p class="flagship__narrative-text"<?= dyn_attrs($flagship['decision'], $flagship['decisionEn']) ?>><?= e(t($flagship['decision'], $flagship['decisionEn'], $lang)) ?></p>
            </div>
            <div>
              <p class="flagship__narrative-label" data-i18n="fp.result.l"><?= e($i18n[$lang]['fp.result.l']) ?></p>
              <p class="flagship__narrative-text"<?= dyn_attrs($flagship['result'], $flagship['resultEn']) ?>><?= e(t($flagship['result'], $flagship['resultEn'], $lang)) ?></p>
            </div>
          </div>
          <div class="flagship__stats">
            <?php foreach ([1, 2, 3] as $n): ?>
              <?php $v = $flagship["stat{$n}Value"]; $l = $flagship["stat{$n}Label"]; $lEn = $flagship["stat{$n}LabelEn"]; ?>
              <?php if ($v): ?>
                <div>
                  <p class="flagship__stat-value"><?= e($v) ?></p>
                  <p class="flagship__stat-label"<?= dyn_attrs($l, $lEn) ?>><?= e(t($l, $lEn, $lang)) ?></p>
                </div>
              <?php endif; ?>
            <?php endforeach; ?>
          </div>
          <div class="flagship__cta">
            <?php if ($flagship['demoUrl']): ?>
              <a href="<?= e(safe_url($flagship['demoUrl'])) ?>" target="_blank" rel="noopener" class="btn btn-accent" data-i18n="cta.demo"><?= e($i18n[$lang]['cta.demo']) ?></a>
            <?php endif; ?>
            <?php if ($flagship['codeUrl']): ?>
              <a href="<?= e(safe_url($flagship['codeUrl'])) ?>" target="_blank" rel="noopener" class="btn btn-outline" data-i18n="cta.code"><?= e($i18n[$lang]['cta.code']) ?></a>
            <?php endif; ?>
          </div>
        </div>
      </div>
    </article>
    <?php endif; ?>

    <div class="projects-grid">
      <?php foreach ($otherProjects as $p): ?>
      <article class="project-card" data-reveal>
        <div class="project-card__browser">
          <div class="project-card__bar">
            <span class="traffic-lights"><span></span><span></span><span></span></span>
            <span class="project-card__domain"><?= e(project_domain($p['title'])) ?></span>
          </div>
          <?php if ($p['image']): ?>
            <img class="project-card__image" src="uploads/projects/<?= e($p['image']) ?>" alt="<?= e($p['title']) ?>" loading="lazy" decoding="async">
          <?php else: ?>
            <div class="project-card__image image-drop"><div class="image-drop__placeholder">Sin captura todavía</div></div>
          <?php endif; ?>
        </div>
        <div class="project-card__body">
          <div class="project-card__head">
            <h3 class="project-card__title"><?= e($p['title']) ?></h3>
            <span class="project-card__tag"><?= e($p['tag']) ?></span>
          </div>
          <p class="project-card__text"><strong data-i18n="proj.what.l"><?= e($i18n[$lang]['proj.what.l']) ?></strong> <span<?= dyn_attrs($p['what'], $p['whatEn']) ?>><?= e(t($p['what'], $p['whatEn'], $lang)) ?></span></p>
          <p class="project-card__text"><strong data-i18n="proj.mine.l"><?= e($i18n[$lang]['proj.mine.l']) ?></strong> <span<?= dyn_attrs($p['mine'], $p['mineEn']) ?>><?= e(t($p['mine'], $p['mineEn'], $lang)) ?></span></p>
          <p class="project-card__impact"><span class="project-card__impact-label" data-i18n="imp.label"><?= e($i18n[$lang]['imp.label']) ?></span><span<?= dyn_attrs($p['impact'], $p['impactEn']) ?>><?= e(t($p['impact'], $p['impactEn'], $lang)) ?></span></p>
          <div class="project-card__stack">
            <?php foreach ($p['stack'] as $tech): ?>
              <span class="chip"><?= e($tech) ?></span>
            <?php endforeach; ?>
          </div>
          <div class="project-card__cta">
            <?php if ($p['demoUrl']): ?>
              <a href="<?= e(safe_url($p['demoUrl'])) ?>" target="_blank" rel="noopener" class="btn btn-accent" data-i18n="cta.demo"><?= e($i18n[$lang]['cta.demo']) ?></a>
            <?php endif; ?>
            <?php if ($p['codeUrl']): ?>
              <a href="<?= e(safe_url($p['codeUrl'])) ?>" target="_blank" rel="noopener" class="btn btn-outline" data-i18n="cta.code"><?= e($i18n[$lang]['cta.code']) ?></a>
            <?php endif; ?>
          </div>
        </div>
      </article>
      <?php endforeach; ?>
    </div>

    <?php if ($githubLink): ?>
    <div class="projects-see-all">
      <a href="<?= e($githubLink) ?>" target="_blank" rel="noopener" class="btn btn-ghost" data-i18n="p.all"><?= e($i18n[$lang]['p.all']) ?></a>
    </div>
    <?php endif; ?>
  </section>

  <!-- HABILIDADES -->
  <section id="stack" class="section">
    <div data-reveal>
      <p class="section-kicker" data-i18n="s.kick"><?= e($i18n[$lang]['s.kick']) ?></p>
      <h2 class="section-title" data-i18n="s.title"><?= e($i18n[$lang]['s.title']) ?></h2>
      <p class="section-intro" data-i18n="s.intro"><?= e($i18n[$lang]['s.intro']) ?></p>
    </div>
    <div class="skills-grid">
      <?php foreach ($data['skills'] as $cat): ?>
      <div class="skill-card" data-reveal>
        <p class="skill-card__title"<?= dyn_attrs($cat['name'], $cat['nameEn']) ?>><?= e(t($cat['name'], $cat['nameEn'], $lang)) ?></p>
        <div class="skill-card__list">
          <?php foreach ($cat['items'] as $skill): ?>
          <div class="skill-row">
            <span class="skill-row__name"><?= e($skill['name']) ?></span>
            <span class="level-pill <?= skill_level_pill_class($skill['level']) ?>"<?= dyn_attrs($skill['level'], $skill['levelEn']) ?>><?= e(t($skill['level'], $skill['levelEn'], $lang)) ?></span>
          </div>
          <?php endforeach; ?>
        </div>
      </div>
      <?php endforeach; ?>
    </div>
  </section>

  <!-- EXPERIENCIA -->
  <section id="experiencia" class="section">
    <div data-reveal>
      <p class="section-kicker" data-i18n="e.kick"><?= e($i18n[$lang]['e.kick']) ?></p>
      <h2 class="section-title section-title--spaced-lg" data-i18n="e.title"><?= e($i18n[$lang]['e.title']) ?></h2>
    </div>
    <div class="timeline">
      <?php foreach ($data['experience'] as $x):
        $bulletsEn = t_list($x['bullets'], $x['bulletsEn'], 'en');
        $bulletsVisible = t_list($x['bullets'], $x['bulletsEn'], $lang);
        $metricsEn = t_list($x['metrics'], $x['metricsEn'], 'en');
        $metricsVisible = t_list($x['metrics'], $x['metricsEn'], $lang);
      ?>
      <div class="timeline-item" data-reveal>
        <p class="timeline-item__date"<?= dyn_attrs($x['dateRange'], $x['dateRangeEn']) ?>><?= e(t($x['dateRange'], $x['dateRangeEn'], $lang)) ?></p>
        <div>
          <h3 class="timeline-item__role"<?= dyn_attrs($x['role'], $x['roleEn']) ?>><?= e(t($x['role'], $x['roleEn'], $lang)) ?></h3>
          <p class="timeline-item__org"<?= dyn_attrs($x['org'], $x['orgEn']) ?>><?= e(t($x['org'], $x['orgEn'], $lang)) ?></p>
          <ul class="timeline-item__bullets">
            <?php foreach ($x['bullets'] as $i => $b): ?>
              <li data-i18n-dynamic data-es="<?= e($b) ?>" data-en="<?= e($bulletsEn[$i]) ?>"><?= e($bulletsVisible[$i]) ?></li>
            <?php endforeach; ?>
          </ul>
          <div class="timeline-item__metrics">
            <?php foreach ($x['metrics'] as $i => $m): ?>
              <span class="metric-pill" data-i18n-dynamic data-es="<?= e($m) ?>" data-en="<?= e($metricsEn[$i]) ?>"><?= e($metricsVisible[$i]) ?></span>
            <?php endforeach; ?>
          </div>
        </div>
      </div>
      <?php endforeach; ?>
    </div>
  </section>

  <!-- FORMACIÓN + CERTIFICACIONES -->
  <section id="formacion" class="section">
    <div class="edu-cert-grid">
      <div data-reveal>
        <p class="section-kicker" data-i18n="ed.kick"><?= e($i18n[$lang]['ed.kick']) ?></p>
        <h2 class="section-title section-title--spaced" data-i18n="ed.title"><?= e($i18n[$lang]['ed.title']) ?></h2>
        <div class="edu-list">
          <?php foreach ($educationEntries as $edu): ?>
            <div class="edu-block">
              <h3 class="edu-block__degree"<?= dyn_attrs($edu['degree'], $edu['degreeEn']) ?>><?= e(t($edu['degree'], $edu['degreeEn'], $lang)) ?></h3>
              <p class="edu-block__org"<?= dyn_attrs($edu['org'], $edu['orgEn']) ?>><?= e(t($edu['org'], $edu['orgEn'], $lang)) ?></p>
              <p class="edu-block__dates"<?= dyn_attrs($edu['dateRange'], $edu['dateRangeEn']) ?>><?= e(t($edu['dateRange'], $edu['dateRangeEn'], $lang)) ?></p>
              <span class="status-pill"<?= dyn_attrs($edu['status'], $edu['statusEn']) ?>><?= e(t($edu['status'], $edu['statusEn'], $lang)) ?></span>
            </div>
          <?php endforeach; ?>
        </div>
        <div class="lang-list">
          <p class="lang-list__label" data-i18n="ed.langsL"><?= e($i18n[$lang]['ed.langsL']) ?></p>
          <?php
            $langLinesEn = t_list($education['languages'], $education['languagesEn'], 'en');
            $langLinesVisible = t_list($education['languages'], $education['languagesEn'], $lang);
          ?>
          <?php foreach ($education['languages'] as $i => $langLine): ?>
            <?php
              [$langName, $langDesc] = array_pad(array_map('trim', explode('—', $langLine, 2)), 2, '');
              [$langNameEn, $langDescEn] = array_pad(array_map('trim', explode('—', $langLinesEn[$i] ?? $langLine, 2)), 2, '');
              [$langNameVisible, $langDescVisible] = array_pad(array_map('trim', explode('—', $langLinesVisible[$i] ?? $langLine, 2)), 2, '');
            ?>
            <p class="lang-list__item">
              <strong data-i18n-dynamic data-es="<?= e($langName) ?>" data-en="<?= e($langNameEn) ?>"><?= e($langNameVisible) ?></strong>
              <span data-i18n-dynamic data-es="— <?= e($langDesc) ?>" data-en="— <?= e($langDescEn) ?>">— <?= e($langDescVisible) ?></span>
            </p>
          <?php endforeach; ?>
        </div>
      </div>
      <div data-reveal>
        <p class="section-kicker" data-i18n="c.kick"><?= e($i18n[$lang]['c.kick']) ?></p>
        <h2 class="section-title section-title--spaced" data-i18n="c.title"><?= e($i18n[$lang]['c.title']) ?></h2>
        <div class="cert-list">
          <?php foreach ($data['certifications'] as $c):
            // La fecha ya no se escribe a mano dentro de "issuer" — se
            // compone aquí siempre a partir de issue_date (ver punto 6),
            // así nunca queda desincronizada del dato real usado para ordenar.
            $dateEs = format_es_date_long($c['issueDate'] ?? null, 'es');
            $dateEn = format_es_date_long($c['issueDate'] ?? null, 'en');
            $issuerFullEs = $dateEs !== '' ? (($c['issuer'] ?? '') . ' · ' . $dateEs) : ($c['issuer'] ?? '');
            $issuerFullEn = $dateEn !== '' ? (($c['issuerEn'] ?: $c['issuer'] ?? '') . ' · ' . $dateEn) : ($c['issuerEn'] ?? '');
          ?>
          <div class="cert-row">
            <span class="cert-row__name"<?= dyn_attrs($c['name'], $c['nameEn']) ?>><?= e(t($c['name'], $c['nameEn'], $lang)) ?></span>
            <span class="cert-row__issuer"<?= dyn_attrs($issuerFullEs, $issuerFullEn) ?>><?= e(t($issuerFullEs, $issuerFullEn, $lang)) ?></span>
          </div>
          <?php endforeach; ?>
        </div>
      </div>
    </div>
  </section>

  <!-- CONTACTO -->
  <section id="contacto" class="section section--contact">
    <div data-reveal>
      <p class="section-kicker" data-i18n="co.kick"><?= e($i18n[$lang]['co.kick']) ?></p>
      <h2 class="contact-title" data-i18n="co.title"><?= e($i18n[$lang]['co.title']) ?></h2>
      <p class="contact-desc" data-i18n="co.desc"><?= e($i18n[$lang]['co.desc']) ?></p>
      <div class="availability-badge">
        <span class="availability-badge__dot"></span>
        <span class="availability-badge__text"<?= dyn_attrs($contact['badge'], $contact['badgeEn']) ?>><?= e(t($contact['badge'], $contact['badgeEn'], $lang)) ?></span>
      </div>
    </div>
    <div class="contact-card" data-reveal>
      <div class="contact-card__bar">
        <span class="traffic-lights"><span></span><span></span><span></span></span>
        <span class="contact-card__bar-label">contacto</span>
      </div>
      <div class="contact-links">
        <?php foreach ($contact['items'] as $item): $href = contact_link_href($item['value']); ?>
        <?php if ($href): ?>
        <a href="<?= e($href) ?>" class="contact-link">
          <span class="contact-link__label"<?= dyn_attrs($item['label'], $item['labelEn']) ?>><?= e(t($item['label'], $item['labelEn'], $lang)) ?></span>
          <span class="contact-link__value"><?= e($item['value']) ?></span>
        </a>
        <?php else: ?>
        <div class="contact-link">
          <span class="contact-link__label"<?= dyn_attrs($item['label'], $item['labelEn']) ?>><?= e(t($item['label'], $item['labelEn'], $lang)) ?></span>
          <span class="contact-link__value"><?= e($item['value']) ?></span>
        </div>
        <?php endif; ?>
        <?php endforeach; ?>
      </div>
    </div>
    <div class="contact-cta">
      <button type="button" class="btn btn-primary" data-cv-open data-i18n="co.cv"><?= e($i18n[$lang]['co.cv']) ?></button>
    </div>
  </section>

  <!-- FOOTER -->
  <footer class="site-footer">
    <div class="site-footer__inner">
      <span class="site-footer__name"><?= e($hero['name']) ?></span>
      <span class="site-footer__location" data-i18n="footer.location"><?= e($i18n[$lang]['footer.location']) ?></span>
    </div>
  </footer>

</div>

<!-- CV OVERLAY -->
<div class="cv-overlay" data-cv-overlay hidden role="dialog" aria-modal="true" aria-labelledby="cv-overlay-title">
  <div class="cv-overlay__bar no-print">
    <span class="cv-overlay__bar-title" id="cv-overlay-title" data-i18n="cv.hdr"><?= e($i18n[$lang]['cv.hdr']) ?></span>
    <div class="cv-overlay__bar-actions">
      <button type="button" class="cv-overlay__lang-btn" data-lang-toggle title="Español / English" aria-label="Cambiar idioma">
        <span class="lang-toggle-dot">◍</span><span data-lang-label><?= $lang === 'en' ? 'ES' : 'EN' ?></span>
      </button>
      <button type="button" class="cv-overlay__download" data-cv-print data-i18n="cv.print"><?= e($i18n[$lang]['cv.print']) ?></button>
      <button type="button" class="cv-overlay__close" data-cv-close data-i18n="cv.close"><?= e($i18n[$lang]['cv.close']) ?></button>
    </div>
  </div>
  <div class="cv-page">
    <?= render_cv_html($data, $lang, $i18n) ?>
  </div>
</div>

<script src="<?= asset_url('assets/js/i18n.js') ?>" defer></script>
<script src="<?= asset_url('assets/js/icons.js') ?>" defer></script>
<script src="<?= asset_url('assets/js/theme.js') ?>" defer></script>
<script src="<?= asset_url('assets/js/typewriter.js') ?>" defer></script>
<script src="<?= asset_url('assets/js/scroll-reveal.js') ?>" defer></script>
<script src="<?= asset_url('assets/js/scroll-spy.js') ?>" defer></script>
<script src="<?= asset_url('assets/js/cv-overlay.js') ?>" defer></script>
</body>
</html>
