<?php
require_once __DIR__ . '/helpers.php';

/**
 * Genera el HTML del CV a partir de los mismos datos que el resto del sitio
 * (hero, contacto, experiencia, educación, habilidades, certificaciones) — no
 * hay texto de CV duplicado/hardcodeado en ningún otro lado, y no se sube
 * ningún archivo aparte: este es el único formato posible, siempre con los
 * datos más recientes. El botón "Descargar CV" del overlay dispara
 * window.print() (ver public/assets/js/cv-overlay.js) para que el visitante
 * lo guarde como PDF con el formato de currículum que usa Marco actualmente
 * (encabezado centrado, barra de contacto, secciones con regla inferior,
 * habilidades y certificaciones en párrafo/grid).
 *
 * Cada bloque de texto lleva data-es/data-en (vía dyn_attrs()/t()) para que
 * el mismo botón ES/EN del sitio lo traduzca al instante, sin recargar —
 * $lang solo decide qué idioma se ve primero al abrir el overlay.
 */
function render_cv_html(array $data, string $lang, array $i18n): string {
    $hero = $data['hero'];
    $contact = $data['contact'];
    $educationEntries = $data['educationEntries'];
    $education = $data['education'];
    $skills = $data['skills'];
    $experience = $data['experience'];
    $certifications = $data['certifications'];

    $tr = fn(string $key) => e($i18n[$lang][$key] ?? $i18n['es'][$key] ?? '');

    $contactParts = [];
    foreach (($contact['items'] ?? []) as $item) {
        if (($item['value'] ?? '') !== '') {
            $contactParts[] = e($item['value']);
        }
    }
    // Editable desde el dashboard (pestaña CV > "Link del portafolio"), no se
    // lee de SITE_URL/config.php: mientras el sitio no tenga un dominio
    // definitivo, Marco deja aquí un valor de ejemplo y lo actualiza él mismo
    // el día que despliegue (ver contact_info.portfolio_url).
    $portfolioUrl = safe_url($contact['portfolioUrl'] ?? '');
    if ($portfolioUrl !== '') {
        $contactParts[] = '<a href="' . e($portfolioUrl) . '">' . e(strip_url_scheme($portfolioUrl)) . '</a>';
    }
    foreach (($data['socialLinks'] ?? []) as $link) {
        $url = safe_social_url($link['url'] ?? '');
        if ($url === '') {
            continue;
        }
        $contactParts[] = '<a href="' . e($url) . '">' . e(strip_url_scheme($url)) . '</a>';
    }

    ob_start();
    ?>
    <header class="resume-header">
        <h1 class="resume-name"><?= e(mb_strtoupper($hero['name'])) ?></h1>
        <p class="resume-role"<?= dyn_attrs($hero['role'], $hero['roleEn']) ?>><?= e(t($hero['role'], $hero['roleEn'], $lang)) ?></p>
        <p class="resume-contact"><?= implode(' &nbsp;|&nbsp; ', $contactParts) ?></p>
    </header>
    <hr class="resume-rule">

    <h2 class="resume-section-title" data-i18n="cv.h.profile"><?= $tr('cv.h.profile') ?></h2>
    <p class="resume-paragraph"<?= dyn_attrs($hero['desc'], $hero['descEn']) ?>><?= e(t($hero['desc'], $hero['descEn'], $lang)) ?></p>

    <h2 class="resume-section-title" data-i18n="cv.h.exp"><?= $tr('cv.h.exp') ?></h2>
    <?php foreach ($experience as $x):
        $bulletsEs = $x['bullets'];
        $bulletsEn = t_list($x['bullets'], $x['bulletsEn'], 'en');
        $bulletsVisible = t_list($x['bullets'], $x['bulletsEn'], $lang);
    ?>
        <div class="resume-row">
            <span class="resume-row__title"<?= dyn_attrs($x['role'], $x['roleEn']) ?>><?= e(t($x['role'], $x['roleEn'], $lang)) ?></span>
            <span class="resume-row__date"<?= dyn_attrs($x['dateRange'], $x['dateRangeEn']) ?>><?= e(t($x['dateRange'], $x['dateRangeEn'], $lang)) ?></span>
        </div>
        <p class="resume-meta"<?= dyn_attrs($x['org'], $x['orgEn']) ?>><?= e(t($x['org'], $x['orgEn'], $lang)) ?></p>
        <ul class="resume-bullets">
            <?php foreach ($bulletsEs as $i => $bullet): ?>
                <li data-i18n-dynamic data-es="<?= e($bullet) ?>" data-en="<?= e($bulletsEn[$i]) ?>"><?= e($bulletsVisible[$i]) ?></li>
            <?php endforeach; ?>
        </ul>
    <?php endforeach; ?>

    <h2 class="resume-section-title" data-i18n="cv.h.edu"><?= $tr('cv.h.edu') ?></h2>
    <?php foreach ($educationEntries as $edu): ?>
        <div class="resume-row">
            <span class="resume-row__title"<?= dyn_attrs($edu['degree'], $edu['degreeEn']) ?>><?= e(t($edu['degree'], $edu['degreeEn'], $lang)) ?></span>
            <span class="resume-row__date"<?= dyn_attrs($edu['dateRange'], $edu['dateRangeEn']) ?>><?= e(t($edu['dateRange'], $edu['dateRangeEn'], $lang)) ?></span>
        </div>
        <p class="resume-meta"<?= dyn_attrs($edu['org'], $edu['orgEn']) ?>><?= e(t($edu['org'], $edu['orgEn'], $lang)) ?></p>
        <p class="resume-meta"><span data-i18n="cv.status.prefix"><?= $tr('cv.status.prefix') ?></span> <span<?= dyn_attrs($edu['status'], $edu['statusEn']) ?>><?= e(t($edu['status'], $edu['statusEn'], $lang)) ?></span></p>
    <?php endforeach; ?>

    <h2 class="resume-section-title" data-i18n="cv.h.skills"><?= $tr('cv.h.skills') ?></h2>
    <p class="resume-paragraph">
        <?php foreach ($skills as $cat):
            $itemNames = implode(', ', array_map(fn($s) => $s['name'], $cat['items']));
        ?>
            <strong<?= dyn_attrs($cat['name'], $cat['nameEn']) ?>><?= e(t($cat['name'], $cat['nameEn'], $lang)) ?>:</strong>
            <?= e($itemNames) ?>.
        <?php endforeach; ?>
    </p>

    <h2 class="resume-section-title" data-i18n="cv.h.certs"><?= $tr('cv.h.certs') ?></h2>
    <div class="resume-certs">
        <?php foreach ($certifications as $c):
            // Misma composición "emisor · fecha" que public/index.php y
            // admin-preview.js — la fecha no se escribe a mano dentro de
            // "issuer", se arma siempre a partir de issueDate (ver punto 6),
            // para que nunca quede desincronizada del dato real usado para
            // ordenar. Antes el CV se saltaba este paso y solo mostraba el
            // emisor, sin fecha.
            $dateEs = format_es_date_long($c['issueDate'] ?? null, 'es');
            $dateEn = format_es_date_long($c['issueDate'] ?? null, 'en');
            $issuerFullEs = $dateEs !== '' ? (($c['issuer'] ?? '') . ' · ' . $dateEs) : ($c['issuer'] ?? '');
            $issuerFullEn = $dateEn !== '' ? (($c['issuerEn'] ?: $c['issuer'] ?? '') . ' · ' . $dateEn) : ($c['issuerEn'] ?? '');
        ?>
            <div class="resume-cert">
                <p class="resume-cert__name"<?= dyn_attrs($c['name'], $c['nameEn']) ?>><?= e(t($c['name'], $c['nameEn'], $lang)) ?></p>
                <p class="resume-cert__issuer"<?= dyn_attrs($issuerFullEs, $issuerFullEn) ?>><?= e(t($issuerFullEs, $issuerFullEn, $lang)) ?></p>
            </div>
        <?php endforeach; ?>
    </div>

    <h2 class="resume-section-title" data-i18n="cv.h.langs"><?= $tr('cv.h.langs') ?></h2>
    <p class="resume-paragraph">
        <?php
            $langLinesEn = t_list($education['languages'], $education['languagesEn'], 'en');
        ?>
        <?php foreach ($education['languages'] as $i => $langLine):
            [$langName, $langDesc] = split_lang_line($langLine);
            [$langNameEn, $langDescEn] = split_lang_line($langLinesEn[$i] ?? $langLine);
            $visibleName = $lang === 'en' ? $langNameEn : $langName;
            $visibleDesc = $lang === 'en' ? $langDescEn : $langDesc;
        ?>
            <strong data-i18n-dynamic data-es="<?= e($langName) ?>" data-en="<?= e($langNameEn) ?>"><?= e($visibleName) ?>:</strong>
            <span data-i18n-dynamic data-es="<?= e($langDesc) ?>" data-en="<?= e($langDescEn) ?>"><?= e($visibleDesc) ?></span>.
        <?php endforeach; ?>
    </p>
    <?php
    return ob_get_clean();
}
