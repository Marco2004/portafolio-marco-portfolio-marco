<?php
require_once __DIR__ . '/helpers.php';

/**
 * Lectura y escritura de todo el contenido editable del portafolio.
 * getAll() arma un solo array asociativo (mismo shape que data-example.json)
 * que consumen tanto el sitio público (SSR) como el dashboard (JSON vía API).
 *
 * Cada campo traducible viene acompañado de su gemelo "<campo>En" (ej. 'desc'
 * y 'descEn') con la versión en inglés capturada manualmente desde el
 * dashboard. Puede venir vacío si el admin todavía no lo ha traducido — el
 * sitio público y el CV caen de regreso al español en ese caso.
 */
class Portfolio {

    // Orden compartido por experience y education_entries (ambas listas
    // "vigente primero, luego más reciente" — ver comentario detallado junto
    // a su primer uso más abajo). Antes vivía duplicado en las dos consultas;
    // un solo lugar para no arriesgar que se desincronicen entre sí.
    private const CURRENT_FIRST_ORDER_BY =
        'CASE WHEN start_date IS NULL THEN 2 WHEN end_date IS NULL THEN 0 ELSE 1 END ASC, ' .
        'end_date DESC, start_date DESC, sort_order ASC, id ASC';

    public static function getAll(PDO $pdo): array {
        $hero = $pdo->query('SELECT * FROM hero WHERE id = 1')->fetch() ?: [];

        $projects = $pdo->query('SELECT * FROM projects ORDER BY sort_order ASC, id ASC')->fetchAll();
        $buttonRows = $pdo->query('SELECT * FROM project_buttons ORDER BY sort_order ASC, id ASC')->fetchAll();
        $projects = array_map(function ($p) use ($buttonRows) {
            $buttons = array_values(array_filter($buttonRows, fn($b) => (int) $b['project_id'] === (int) $p['id']));
            $buttons = array_map(fn($b) => [
                'label' => $b['label'],
                'labelEn' => $b['label_en'],
                'url' => $b['url'],
                'style' => $b['style'],
            ], $buttons);
            // Auto-migración no destructiva: un proyecto guardado antes de que
            // existiera project_buttons (punto 13) todavía no tiene filas ahí,
            // pero sí puede tener demo_url/code_url con contenido — se
            // sintetizan como botones equivalentes la primera vez que se lee,
            // así no se pierden al pasar al nuevo formato. En cuanto el admin
            // guarde de nuevo, saveAll() ya persiste esto como filas reales.
            if (empty($buttons)) {
                if (!empty($p['demo_url'])) {
                    $buttons[] = ['label' => 'Demo', 'labelEn' => null, 'url' => $p['demo_url'], 'style' => 'primary'];
                }
                if (!empty($p['code_url'])) {
                    $buttons[] = ['label' => 'Código', 'labelEn' => 'Code', 'url' => $p['code_url'], 'style' => 'secondary'];
                }
            }
            return [
                'id' => (int) $p['id'],
                'flagship' => (bool) $p['is_flagship'],
                'title' => $p['title'],
                'tag' => $p['tag'],
                'what' => $p['what_it_does'],
                'whatEn' => $p['what_it_does_en'],
                'mine' => $p['my_contribution'],
                'mineEn' => $p['my_contribution_en'],
                'impact' => $p['impact'],
                'impactEn' => $p['impact_en'],
                'stack' => csv_to_array($p['stack'] ?? ''),
                'buttons' => $buttons,
                'image' => $p['image_path'],
                'problem' => $p['problem'],
                'problemEn' => $p['problem_en'],
                'decision' => $p['decision_text'],
                'decisionEn' => $p['decision_text_en'],
                'result' => $p['result'],
                'resultEn' => $p['result_en'],
                'stat1Value' => $p['stat1_value'],
                'stat1Label' => $p['stat1_label'],
                'stat1LabelEn' => $p['stat1_label_en'],
                'stat2Value' => $p['stat2_value'],
                'stat2Label' => $p['stat2_label'],
                'stat2LabelEn' => $p['stat2_label_en'],
                'stat3Value' => $p['stat3_value'],
                'stat3Label' => $p['stat3_label'],
                'stat3LabelEn' => $p['stat3_label_en'],
            ];
        }, $projects);

        $categories = $pdo->query('SELECT * FROM skill_categories ORDER BY sort_order ASC, id ASC')->fetchAll();
        $skillRows = $pdo->query('SELECT * FROM skills ORDER BY sort_order ASC, id ASC')->fetchAll();
        $skills = array_map(function ($cat) use ($skillRows) {
            $items = array_values(array_filter($skillRows, fn($s) => (int) $s['category_id'] === (int) $cat['id']));
            return [
                'id' => (int) $cat['id'],
                'name' => $cat['name'],
                'nameEn' => $cat['name_en'],
                'items' => array_map(fn($s) => [
                    'id' => (int) $s['id'],
                    'name' => $s['name'],
                    'level' => $s['level'],
                    'levelEn' => $s['level_en'],
                    // NULL = sin personalizar — el pill sigue usando las
                    // clases de color existentes (skill_level_pill_class(),
                    // que se adaptan solas a claro/oscuro vía variables CSS) y
                    // se queda así indefinidamente, no solo hasta el próximo
                    // guardado. Un hex explícito aquí anula esa clase con un
                    // color fijo (ver render en public/index.php /
                    // admin-preview.js) — se guarda únicamente cuando el
                    // admin elige un color a mano (ver saveAll()).
                    'levelColor' => $s['level_color'] ?: null,
                ], $items),
            ];
        }, $categories);

        // Los niveles de habilidad (antes 5 presets fijos por código) ahora
        // son datos que el admin gestiona: agregar, eliminar, recolorear
        // cualquiera. Cada definición vive en UN idioma a la vez (label O
        // labelEn, no traducción automática — decisión explícita, ver
        // admin-forms.js/skillLevelField()) excepto los 5 presets originales
        // (sembrados con ambos). Auto-migración no destructiva (mismo
        // criterio que project_buttons arriba): cualquier (nivel, color) que
        // ya exista en `skills` —en cualquiera de los dos idiomas— pero
        // todavía no esté en skill_levels se agrega aquí solo para esta
        // lectura — se vuelve permanente recién cuando el admin guarde de
        // nuevo (ver saveAll()), así ningún color ya elegido antes de que
        // existiera esta tabla se pierde ni se ve gris de repente.
        $levelRows = $pdo->query('SELECT * FROM skill_levels ORDER BY sort_order ASC, id ASC')->fetchAll();
        $skillLevels = array_map(fn($l) => [
            'label' => $l['label'],
            'labelEn' => $l['label_en'],
            'color' => $l['color'],
        ], $levelRows);
        $seenEs = [];
        $seenEn = [];
        foreach ($skillLevels as $lvl) {
            if ($lvl['label']) $seenEs[mb_strtolower(trim($lvl['label']))] = true;
            if ($lvl['labelEn']) $seenEn[mb_strtolower(trim($lvl['labelEn']))] = true;
        }
        foreach ($skills as $cat) {
            foreach ($cat['items'] as $item) {
                if (!$item['levelColor']) {
                    continue;
                }
                $lvlEs = trim($item['level'] ?? '');
                if ($lvlEs !== '' && !isset($seenEs[mb_strtolower($lvlEs)])) {
                    $seenEs[mb_strtolower($lvlEs)] = true;
                    $skillLevels[] = ['label' => $lvlEs, 'labelEn' => null, 'color' => $item['levelColor']];
                }
                $lvlEn = trim($item['levelEn'] ?? '');
                if ($lvlEn !== '' && !isset($seenEn[mb_strtolower($lvlEn)])) {
                    $seenEn[mb_strtolower($lvlEn)] = true;
                    $skillLevels[] = ['label' => null, 'labelEn' => $lvlEn, 'color' => $item['levelColor']];
                }
            }
        }

        // Siempre de la más reciente a la más antigua, sin importar el orden en
        // que se guardaron (ya no es un orden manual — ver bindExperienceList()
        // en admin-forms.js, que aplica el mismo criterio en vivo mientras se
        // edita). "Vigente" (con start_date pero sin end_date — isCurrent en el
        // formulario) siempre va primero, sin importar cuándo empezó: un puesto
        // vigente que arrancó hace tiempo sigue siendo más "reciente" que uno
        // que ya terminó, aunque este haya empezado después. Una fila sin
        // ninguna fecha (recién agregada, todavía sin llenar) no cuenta como
        // vigente — va al final. Entre dos puestos vigentes, o si dos fechas de
        // fin coinciden (meses que se juntan), se desempata por start_date y por
        // último por sort_order/id.
        $experienceRows = $pdo->query(
            'SELECT * FROM experience ORDER BY ' . self::CURRENT_FIRST_ORDER_BY
        )->fetchAll();
        $experience = array_map(function ($x) {
            return [
                'id' => (int) $x['id'],
                'role' => $x['role'],
                'roleEn' => $x['role_en'],
                'org' => $x['org'],
                'orgEn' => $x['org_en'],
                'dateRange' => $x['date_range'],
                'dateRangeEn' => $x['date_range_en'],
                'startDate' => $x['start_date'] ?: '',
                'endDate' => $x['end_date'] ?: '',
                'bullets' => lines_to_array($x['bullets'] ?? ''),
                'bulletsEn' => lines_to_array($x['bullets_en'] ?? ''),
                'metrics' => csv_to_array($x['metrics'] ?? ''),
                'metricsEn' => csv_to_array($x['metrics_en'] ?? ''),
            ];
        }, $experienceRows);

        $eduRow = $pdo->query('SELECT * FROM education WHERE id = 1')->fetch() ?: [];
        $education = [
            'languages' => lines_to_array($eduRow['languages'] ?? ''),
            'languagesEn' => lines_to_array($eduRow['languages_en'] ?? ''),
        ];

        // Títulos/grados académicos — lista libre (punto 9), mismo criterio de
        // orden que experience (ver comentario de arriba): vigente primero.
        $eduEntryRows = $pdo->query(
            'SELECT * FROM education_entries ORDER BY ' . self::CURRENT_FIRST_ORDER_BY
        )->fetchAll();
        $educationEntries = array_map(fn($x) => [
            'id' => (int) $x['id'],
            'degree' => $x['degree'],
            'degreeEn' => $x['degree_en'],
            'org' => $x['org'],
            'orgEn' => $x['org_en'],
            'dateRange' => $x['date_range'],
            'dateRangeEn' => $x['date_range_en'],
            'startDate' => $x['start_date'] ?: '',
            'endDate' => $x['end_date'] ?: '',
            'status' => $x['status'],
            'statusEn' => $x['status_en'],
        ], $eduEntryRows);

        // Mismo criterio que experience: siempre por issue_date real, más
        // reciente primero.
        $certRows = $pdo->query('SELECT * FROM certifications ORDER BY (issue_date IS NULL) ASC, issue_date DESC, sort_order ASC, id ASC')->fetchAll();
        $certifications = array_map(fn($c) => [
            'id' => (int) $c['id'],
            'name' => $c['name'],
            'nameEn' => $c['name_en'],
            'issuer' => $c['issuer'],
            'issuerEn' => $c['issuer_en'],
            'issueDate' => $c['issue_date'] ?: '',
        ], $certRows);

        $contactRow = $pdo->query('SELECT * FROM contact_info WHERE id = 1')->fetch() ?: [];
        $contactRows = $pdo->query('SELECT * FROM contacts ORDER BY sort_order ASC, id ASC')->fetchAll();
        $contact = [
            'badge' => $contactRow['availability_badge'] ?? '',
            'badgeEn' => $contactRow['availability_badge_en'] ?? '',
            // NULL = LED verde por defecto, mismo criterio que hero.availColor.
            'badgeColor' => $contactRow['availability_badge_color'] ?? null,
            'portfolioUrl' => $contactRow['portfolio_url'] ?? '',
            'items' => array_map(fn($c) => [
                'label' => $c['label'],
                'labelEn' => $c['label_en'],
                'value' => $c['value'],
            ], $contactRows),
        ];

        $socialRows = $pdo->query('SELECT * FROM social_links ORDER BY sort_order ASC, id ASC')->fetchAll();
        $socialLinks = array_map(fn($s) => ['url' => $s['url']], $socialRows);

        // "Ficha rápida" del hero — lista libre de dato+valor (ver punto 3),
        // reemplaza las 3 columnas fijas que antes vivían en hero.
        $heroFactRows = $pdo->query('SELECT * FROM hero_facts ORDER BY sort_order ASC, id ASC')->fetchAll();
        $heroFacts = array_map(fn($f) => [
            'label' => $f['label'],
            'labelEn' => $f['label_en'],
            'value' => $f['value'],
            'valueEn' => $f['value_en'],
        ], $heroFactRows);

        return [
            'hero' => [
                'avail' => $hero['avail'] ?? '',
                'availEn' => $hero['avail_en'] ?? '',
                // NULL = LED verde por defecto (mismo aspecto que antes de
                // poder personalizarlo, ver hero.css .hero__badge-dot).
                'availColor' => $hero['avail_color'] ?? null,
                'name' => $hero['name'] ?? '',
                'role' => $hero['role'] ?? '',
                'roleEn' => $hero['role_en'] ?? '',
                'desc' => $hero['description'] ?? '',
                'descEn' => $hero['description_en'] ?? '',
            ],
            'heroFacts' => $heroFacts,
            'projects' => $projects,
            'skills' => $skills,
            'skillLevels' => $skillLevels,
            'experience' => $experience,
            'education' => $education,
            'educationEntries' => $educationEntries,
            'certifications' => $certifications,
            'contact' => $contact,
            'socialLinks' => $socialLinks,
        ];
    }

    /**
     * Reemplaza todo el contenido editable en una sola transacción.
     * $data trae el mismo shape que getAll(). El CV descargable ya no es un
     * archivo subido — se genera siempre con render_cv_html() (src/Cv.php) a
     * partir de estos mismos datos, así que no hay nada de CV que guardar
     * aparte aquí.
     */
    public static function saveAll(PDO $pdo, array $data): void {
        $pdo->beginTransaction();
        try {
            $h = $data['hero'] ?? [];
            $stmt = $pdo->prepare('
                UPDATE hero SET avail=:avail, avail_en=:avail_en, avail_color=:avail_color, name=:name, role=:role, role_en=:role_en,
                    description=:description, description_en=:description_en
                WHERE id = 1
            ');
            $stmt->execute([
                'avail' => cap($h['avail'] ?? '', 255),
                'avail_en' => cap($h['availEn'] ?? '', 255),
                'avail_color' => safe_hex_color($h['availColor'] ?? null),
                'name' => cap($h['name'] ?? '', 120),
                'role' => cap($h['role'] ?? '', 160),
                'role_en' => cap($h['roleEn'] ?? '', 160),
                'description' => $h['desc'] ?? '',
                'description_en' => $h['descEn'] ?? '',
            ]);

            $pdo->exec('DELETE FROM hero_facts');
            $insFact = $pdo->prepare('INSERT INTO hero_facts (label, label_en, value, value_en, sort_order) VALUES (:label, :label_en, :value, :value_en, :sort)');
            foreach (($data['heroFacts'] ?? []) as $i => $fact) {
                $label = cap($fact['label'] ?? '', 80);
                $value = cap($fact['value'] ?? '', 200);
                if ($label === '' || $value === '') {
                    continue;
                }
                $insFact->execute([
                    'label' => $label,
                    'label_en' => isset($fact['labelEn']) ? cap($fact['labelEn'], 80) : null,
                    'value' => $value,
                    'value_en' => isset($fact['valueEn']) ? cap($fact['valueEn'], 200) : null,
                    'sort' => $i,
                ]);
            }

            // Antes de reemplazar la tabla, se guardan las imágenes que
            // tenía cada proyecto para poder borrar del disco (después del
            // commit) las que ya no queden referenciadas por ningún
            // proyecto nuevo — si no, cada vez que el admin cambia la
            // portada de un proyecto la imagen anterior se queda huérfana
            // en public/uploads/projects/ para siempre (save_uploaded_file()
            // en helpers.php genera un nombre nuevo en cada subida y nunca
            // borra el anterior por su cuenta).
            $oldImages = $pdo->query('SELECT image_path FROM projects WHERE image_path IS NOT NULL AND image_path != \'\'')
                ->fetchAll(PDO::FETCH_COLUMN);

            $pdo->exec('DELETE FROM projects');
            // project_buttons se borra solo (ON DELETE CASCADE) al borrar sus
            // proyectos, ver database/schema.sql.
            $insProj = $pdo->prepare('
                INSERT INTO projects (is_flagship, title, tag, what_it_does, what_it_does_en, my_contribution, my_contribution_en,
                    impact, impact_en, stack, image_path,
                    problem, problem_en, decision_text, decision_text_en, result, result_en,
                    stat1_value, stat1_label, stat1_label_en, stat2_value, stat2_label, stat2_label_en,
                    stat3_value, stat3_label, stat3_label_en, sort_order)
                VALUES (:flagship, :title, :tag, :what, :what_en, :mine, :mine_en,
                    :impact, :impact_en, :stack, :image,
                    :problem, :problem_en, :decision, :decision_en, :result, :result_en,
                    :s1v, :s1l, :s1l_en, :s2v, :s2l, :s2l_en,
                    :s3v, :s3l, :s3l_en, :sort)
            ');
            // Botones del CTA (punto 13) — cantidad libre, reemplaza los 2
            // fijos (demo_url/code_url) que antes vivían como columnas de
            // projects; esas columnas se dejan sin tocar (NULL en proyectos
            // nuevos) solo para que Portfolio::getAll() pueda auto-migrar
            // proyectos guardados antes de este cambio.
            $insBtn = $pdo->prepare('INSERT INTO project_buttons (project_id, label, label_en, url, style, sort_order) VALUES (:project_id, :label, :label_en, :url, :style, :sort)');
            // El dashboard ya bloquea marcar un segundo insignia (ver el
            // listener "change" de Proyectos en admin-forms.js), pero se
            // refuerza aquí también: si por cualquier vía llega más de uno
            // marcado, solo el primero en el orden recibido se guarda como tal.
            $flagshipSeen = false;
            foreach (($data['projects'] ?? []) as $i => $p) {
                $title = cap($p['title'] ?? '', 160);
                // Mismo criterio que heroFacts/contacts/socialLinks más abajo:
                // sin título no hay nada que mostrar como encabezado del
                // proyecto en el sitio público, así que se descarta en vez de
                // guardar una fila con <h3></h3> vacío.
                if ($title === '') {
                    continue;
                }
                $isFlagship = !empty($p['flagship']) && !$flagshipSeen;
                if ($isFlagship) {
                    $flagshipSeen = true;
                }
                $insProj->execute([
                    'flagship' => $isFlagship ? 1 : 0,
                    'title' => $title,
                    'tag' => cap($p['tag'] ?? '', 120),
                    'what' => $p['what'] ?? '',
                    'what_en' => $p['whatEn'] ?? null,
                    'mine' => $p['mine'] ?? '',
                    'mine_en' => $p['mineEn'] ?? null,
                    'impact' => cap($p['impact'] ?? '', 255),
                    'impact_en' => isset($p['impactEn']) ? cap($p['impactEn'], 255) : null,
                    'stack' => array_to_csv($p['stack'] ?? []),
                    // basename(): image_path solo debe ser un nombre de archivo
                    // generado por save_uploaded_file() (helpers.php), nunca una
                    // ruta — mismo criterio defensivo que ya se aplica más abajo
                    // al borrar huérfanos, para que un valor con "../" no pueda
                    // apuntar fuera de UPLOAD_PROJECTS_DIR al renderizarse.
                    'image' => !empty($p['image']) ? basename($p['image']) : null,
                    'problem' => $p['problem'] ?? null,
                    'problem_en' => $p['problemEn'] ?? null,
                    'decision' => $p['decision'] ?? null,
                    'decision_en' => $p['decisionEn'] ?? null,
                    'result' => $p['result'] ?? null,
                    'result_en' => $p['resultEn'] ?? null,
                    's1v' => isset($p['stat1Value']) ? cap($p['stat1Value'], 40) : null,
                    's1l' => isset($p['stat1Label']) ? cap($p['stat1Label'], 120) : null,
                    's1l_en' => isset($p['stat1LabelEn']) ? cap($p['stat1LabelEn'], 120) : null,
                    's2v' => isset($p['stat2Value']) ? cap($p['stat2Value'], 40) : null,
                    's2l' => isset($p['stat2Label']) ? cap($p['stat2Label'], 120) : null,
                    's2l_en' => isset($p['stat2LabelEn']) ? cap($p['stat2LabelEn'], 120) : null,
                    's3v' => isset($p['stat3Value']) ? cap($p['stat3Value'], 40) : null,
                    's3l' => isset($p['stat3Label']) ? cap($p['stat3Label'], 120) : null,
                    's3l_en' => isset($p['stat3LabelEn']) ? cap($p['stat3LabelEn'], 120) : null,
                    'sort' => $i,
                ]);

                $projectId = (int) $pdo->lastInsertId();
                foreach (($p['buttons'] ?? []) as $bi => $btn) {
                    // safe_url() descarta cualquier valor que no empiece con
                    // http(s):// (mismo criterio que ya se usaba para
                    // demo_url/code_url y que se usa para redes sociales,
                    // ver safe_social_url() más abajo) — nunca se guarda un
                    // esquema "javascript:..." ni similar.
                    $url = cap(safe_url($btn['url'] ?? ''), 255);
                    $label = cap($btn['label'] ?? '', 80);
                    if ($url === '' || $label === '') {
                        continue;
                    }
                    // Whitelist server-side: nunca se confía en el string de
                    // "style" que manda el cliente para meterlo tal cual en
                    // una columna ENUM/clase CSS — solo se acepta uno de los
                    // 2 valores válidos, cualquier otra cosa cae a "secondary".
                    $style = ($btn['style'] ?? '') === 'primary' ? 'primary' : 'secondary';
                    $insBtn->execute([
                        'project_id' => $projectId,
                        'label' => $label,
                        'label_en' => isset($btn['labelEn']) ? cap($btn['labelEn'], 80) : null,
                        'url' => $url,
                        'style' => $style,
                        'sort' => $bi,
                    ]);
                }
            }

            $pdo->exec('DELETE FROM skills');
            $pdo->exec('DELETE FROM skill_categories');
            $insCat = $pdo->prepare('INSERT INTO skill_categories (name, name_en, sort_order) VALUES (:name, :name_en, :sort)');
            $insSkill = $pdo->prepare('INSERT INTO skills (category_id, name, level, level_en, level_color, sort_order) VALUES (:cat, :name, :level, :level_en, :level_color, :sort)');
            foreach (($data['skills'] ?? []) as $ci => $cat) {
                $insCat->execute(['name' => cap($cat['name'] ?? '', 120), 'name_en' => isset($cat['nameEn']) ? cap($cat['nameEn'], 120) : null, 'sort' => $ci]);
                $catId = (int) $pdo->lastInsertId();
                foreach (($cat['items'] ?? []) as $si => $skill) {
                    // NULL a propósito si el admin no eligió un color a mano
                    // (preset sin personalizar) — así el pill se sigue
                    // pintando con las clases CSS existentes, que se adaptan
                    // solas a claro/oscuro (ver skill_level_pill_class() y su
                    // uso en public/index.php). Guardar aquí un hex "de
                    // relleno" en cada guardado (aunque el admin no haya
                    // tocado el color) congelaría ese nivel a un solo tono fijo
                    // sin importar el tema — justo lo que NO se quiere para
                    // datos sin personalizar.
                    $insSkill->execute([
                        'cat' => $catId,
                        'name' => cap($skill['name'] ?? '', 120),
                        'level' => cap($skill['level'] ?? '', 60),
                        'level_en' => isset($skill['levelEn']) ? cap($skill['levelEn'], 60) : null,
                        'level_color' => safe_hex_color($skill['levelColor'] ?? null),
                        'sort' => $si,
                    ]);
                }
            }

            // Lista de niveles gestionable por el admin (ver comentario en
            // getAll()) — mismo patrón delete+reinsert que el resto de listas
            // de este método. Se descarta cualquier fila sin texto o sin un
            // color hex válido (safe_hex_color() nunca confía en el string
            // del cliente).
            $pdo->exec('DELETE FROM skill_levels');
            $insLevel = $pdo->prepare('INSERT INTO skill_levels (label, label_en, color, sort_order) VALUES (:label, :label_en, :color, :sort)');
            $li = 0;
            foreach (($data['skillLevels'] ?? []) as $lvl) {
                $label = cap($lvl['label'] ?? '', 60);
                $labelEn = cap($lvl['labelEn'] ?? '', 60);
                $color = safe_hex_color($lvl['color'] ?? null);
                // Al menos un idioma (no traducción automática, ver
                // skillLevelField() en admin-forms.js) y un color válido.
                if (($label === '' && $labelEn === '') || $color === null) {
                    continue;
                }
                $insLevel->execute([
                    'label' => $label !== '' ? $label : null,
                    'label_en' => $labelEn !== '' ? $labelEn : null,
                    'color' => $color,
                    'sort' => $li++,
                ]);
            }

            $pdo->exec('DELETE FROM experience');
            $insExp = $pdo->prepare('
                INSERT INTO experience (role, role_en, org, org_en, date_range, date_range_en, start_date, end_date, bullets, bullets_en, metrics, metrics_en, sort_order)
                VALUES (:role, :role_en, :org, :org_en, :range, :range_en, :start_date, :end_date, :bullets, :bullets_en, :metrics, :metrics_en, :sort)
            ');
            foreach (($data['experience'] ?? []) as $i => $x) {
                // dateRange/dateRangeEn ya no se escriben a mano en el dashboard
                // (ver admin-datepicker.js): se recalculan aquí siempre a partir
                // de las fechas reales, para que nunca queden desincronizados.
                $startDate = iso_date_or_null($x['startDate'] ?? null);
                $endDate = iso_date_or_null($x['endDate'] ?? null);
                $insExp->execute([
                    'role' => cap($x['role'] ?? '', 160),
                    'role_en' => isset($x['roleEn']) ? cap($x['roleEn'], 160) : null,
                    'org' => cap($x['org'] ?? '', 160),
                    'org_en' => isset($x['orgEn']) ? cap($x['orgEn'], 160) : null,
                    'range' => format_date_range($startDate, $endDate, 'es'),
                    'range_en' => format_date_range($startDate, $endDate, 'en'),
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'bullets' => array_to_lines($x['bullets'] ?? []),
                    'bullets_en' => array_to_lines($x['bulletsEn'] ?? []),
                    'metrics' => array_to_csv($x['metrics'] ?? []),
                    'metrics_en' => array_to_csv($x['metricsEn'] ?? []),
                    'sort' => $i,
                ]);
            }

            $edu = $data['education'] ?? [];
            $stmt = $pdo->prepare('UPDATE education SET languages=:langs, languages_en=:langs_en WHERE id = 1');
            $stmt->execute([
                'langs' => array_to_lines($edu['languages'] ?? []),
                'langs_en' => array_to_lines($edu['languagesEn'] ?? []),
            ]);

            $pdo->exec('DELETE FROM education_entries');
            $insEdu = $pdo->prepare('
                INSERT INTO education_entries (degree, degree_en, org, org_en, date_range, date_range_en, start_date, end_date, status, status_en, sort_order)
                VALUES (:degree, :degree_en, :org, :org_en, :range, :range_en, :start_date, :end_date, :status, :status_en, :sort)
            ');
            foreach (($data['educationEntries'] ?? []) as $i => $x) {
                $eduStart = iso_date_or_null($x['startDate'] ?? null);
                $eduEnd = iso_date_or_null($x['endDate'] ?? null);
                $insEdu->execute([
                    'degree' => cap($x['degree'] ?? '', 160),
                    'degree_en' => isset($x['degreeEn']) ? cap($x['degreeEn'], 160) : null,
                    'org' => cap($x['org'] ?? '', 160),
                    'org_en' => isset($x['orgEn']) ? cap($x['orgEn'], 160) : null,
                    'range' => format_date_range($eduStart, $eduEnd, 'es'),
                    'range_en' => format_date_range($eduStart, $eduEnd, 'en'),
                    'start_date' => $eduStart,
                    'end_date' => $eduEnd,
                    'status' => cap($x['status'] ?? '', 160),
                    'status_en' => isset($x['statusEn']) ? cap($x['statusEn'], 160) : null,
                    'sort' => $i,
                ]);
            }

            $pdo->exec('DELETE FROM certifications');
            $insCert = $pdo->prepare('INSERT INTO certifications (name, name_en, issuer, issuer_en, issue_date, sort_order) VALUES (:name, :name_en, :issuer, :issuer_en, :issue_date, :sort)');
            foreach (($data['certifications'] ?? []) as $i => $c) {
                $insCert->execute([
                    'name' => cap($c['name'] ?? '', 200),
                    'name_en' => isset($c['nameEn']) ? cap($c['nameEn'], 200) : null,
                    'issuer' => cap($c['issuer'] ?? '', 160),
                    'issuer_en' => isset($c['issuerEn']) ? cap($c['issuerEn'], 160) : null,
                    'issue_date' => iso_date_or_null($c['issueDate'] ?? null),
                    'sort' => $i,
                ]);
            }

            $contact = $data['contact'] ?? [];
            $stmt = $pdo->prepare('
                UPDATE contact_info SET availability_badge=:badge, availability_badge_en=:badge_en, availability_badge_color=:badge_color, portfolio_url=:portfolio_url
                WHERE id = 1
            ');
            $stmt->execute([
                'badge' => cap($contact['badge'] ?? '', 255),
                'badge_en' => isset($contact['badgeEn']) ? cap($contact['badgeEn'], 255) : null,
                'badge_color' => safe_hex_color($contact['badgeColor'] ?? null),
                'portfolio_url' => cap(safe_url($contact['portfolioUrl'] ?? ''), 255),
            ]);

            $pdo->exec('DELETE FROM contacts');
            $insContact = $pdo->prepare('INSERT INTO contacts (label, label_en, value, sort_order) VALUES (:label, :label_en, :value, :sort)');
            foreach (($contact['items'] ?? []) as $i => $item) {
                $label = cap($item['label'] ?? '', 80);
                $value = cap($item['value'] ?? '', 255);
                if ($label === '' || $value === '') {
                    continue;
                }
                $insContact->execute([
                    'label' => $label,
                    'label_en' => isset($item['labelEn']) ? cap($item['labelEn'], 80) : null,
                    'value' => $value,
                    'sort' => $i,
                ]);
            }

            $pdo->exec('DELETE FROM social_links');
            $insSocial = $pdo->prepare('INSERT INTO social_links (url, sort_order) VALUES (:url, :sort)');
            foreach (($data['socialLinks'] ?? []) as $i => $link) {
                $url = cap(safe_social_url($link['url'] ?? ''), 500);
                if ($url === '') {
                    continue;
                }
                $insSocial->execute(['url' => $url, 'sort' => $i]);
            }

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        // Recién después del commit (no hay nada que revertir en disco si la
        // transacción falla): borra del disco las imágenes que ya no usa
        // ningún proyecto. basename() + confinar a UPLOAD_PROJECTS_DIR
        // evita que un image_path con "../" pudiera borrar algo fuera de esa
        // carpeta.
        // basename() también del lado "nuevo": $oldImages sale de la BD y ya
        // son puros nombres de archivo (se guardan así al insertar, ver
        // arriba), pero $newImages viene tal cual del payload del cliente —
        // sin normalizar ambos lados igual, array_diff() podía no reconocer
        // como "la misma imagen" una que en teoría sigue en uso y borrarla
        // del disco por error.
        $newImages = array_map(
            static fn ($img) => basename((string) $img),
            array_column($data['projects'] ?? [], 'image')
        );
        foreach (array_diff($oldImages, $newImages) as $orphan) {
            $path = UPLOAD_PROJECTS_DIR . '/' . basename($orphan);
            if (is_file($path)) {
                unlink($path);
            }
        }
    }

}
