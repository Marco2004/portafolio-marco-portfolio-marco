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

    public static function getAll(PDO $pdo): array {
        $hero = $pdo->query('SELECT * FROM hero WHERE id = 1')->fetch() ?: [];

        $projects = $pdo->query('SELECT * FROM projects ORDER BY sort_order ASC, id ASC')->fetchAll();
        $projects = array_map(function ($p) {
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
                'demoUrl' => $p['demo_url'],
                'codeUrl' => $p['code_url'],
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
                ], $items),
            ];
        }, $categories);

        // Siempre de la más reciente a la más antigua por start_date real, sin
        // importar el orden en que se guardaron (sort_order queda solo como
        // desempate estable entre filas sin fecha) — ya no es un orden manual.
        $experienceRows = $pdo->query('SELECT * FROM experience ORDER BY (start_date IS NULL) ASC, start_date DESC, sort_order ASC, id ASC')->fetchAll();
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
        // orden que experience: más reciente primero por start_date real.
        $eduEntryRows = $pdo->query('SELECT * FROM education_entries ORDER BY (start_date IS NULL) ASC, start_date DESC, sort_order ASC, id ASC')->fetchAll();
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
                'name' => $hero['name'] ?? '',
                'role' => $hero['role'] ?? '',
                'roleEn' => $hero['role_en'] ?? '',
                'desc' => $hero['description'] ?? '',
                'descEn' => $hero['description_en'] ?? '',
            ],
            'heroFacts' => $heroFacts,
            'projects' => $projects,
            'skills' => $skills,
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
                UPDATE hero SET avail=:avail, avail_en=:avail_en, name=:name, role=:role, role_en=:role_en,
                    description=:description, description_en=:description_en
                WHERE id = 1
            ');
            $stmt->execute([
                'avail' => $h['avail'] ?? '',
                'avail_en' => $h['availEn'] ?? '',
                'name' => $h['name'] ?? '',
                'role' => $h['role'] ?? '',
                'role_en' => $h['roleEn'] ?? '',
                'description' => $h['desc'] ?? '',
                'description_en' => $h['descEn'] ?? '',
            ]);

            $pdo->exec('DELETE FROM hero_facts');
            $insFact = $pdo->prepare('INSERT INTO hero_facts (label, label_en, value, value_en, sort_order) VALUES (:label, :label_en, :value, :value_en, :sort)');
            foreach (($data['heroFacts'] ?? []) as $i => $fact) {
                $label = trim($fact['label'] ?? '');
                $value = trim($fact['value'] ?? '');
                if ($label === '' || $value === '') {
                    continue;
                }
                $insFact->execute([
                    'label' => $label,
                    'label_en' => $fact['labelEn'] ?? null,
                    'value' => $value,
                    'value_en' => $fact['valueEn'] ?? null,
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
            $insProj = $pdo->prepare('
                INSERT INTO projects (is_flagship, title, tag, what_it_does, what_it_does_en, my_contribution, my_contribution_en,
                    impact, impact_en, stack, demo_url, code_url, image_path,
                    problem, problem_en, decision_text, decision_text_en, result, result_en,
                    stat1_value, stat1_label, stat1_label_en, stat2_value, stat2_label, stat2_label_en,
                    stat3_value, stat3_label, stat3_label_en, sort_order)
                VALUES (:flagship, :title, :tag, :what, :what_en, :mine, :mine_en,
                    :impact, :impact_en, :stack, :demo, :code, :image,
                    :problem, :problem_en, :decision, :decision_en, :result, :result_en,
                    :s1v, :s1l, :s1l_en, :s2v, :s2l, :s2l_en,
                    :s3v, :s3l, :s3l_en, :sort)
            ');
            // El dashboard ya bloquea marcar un segundo insignia (ver el
            // listener "change" de Proyectos en admin-forms.js), pero se
            // refuerza aquí también: si por cualquier vía llega más de uno
            // marcado, solo el primero en el orden recibido se guarda como tal.
            $flagshipSeen = false;
            foreach (($data['projects'] ?? []) as $i => $p) {
                $isFlagship = !empty($p['flagship']) && !$flagshipSeen;
                if ($isFlagship) {
                    $flagshipSeen = true;
                }
                $insProj->execute([
                    'flagship' => $isFlagship ? 1 : 0,
                    'title' => $p['title'] ?? '',
                    'tag' => $p['tag'] ?? '',
                    'what' => $p['what'] ?? '',
                    'what_en' => $p['whatEn'] ?? null,
                    'mine' => $p['mine'] ?? '',
                    'mine_en' => $p['mineEn'] ?? null,
                    'impact' => $p['impact'] ?? '',
                    'impact_en' => $p['impactEn'] ?? null,
                    'stack' => array_to_csv($p['stack'] ?? []),
                    // safe_url() descarta cualquier valor que no empiece con
                    // http(s):// — igual que ya se hace con las redes
                    // sociales (safe_social_url() más abajo). Antes esto solo
                    // se filtraba al RENDERIZAR (public/index.php), no al
                    // guardar, así que un valor "javascript:..." vivía tal
                    // cual en la base de datos a la espera de que algún
                    // template futuro olvidara envolverlo.
                    'demo' => safe_url($p['demoUrl'] ?? ''),
                    'code' => safe_url($p['codeUrl'] ?? ''),
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
                    's1v' => $p['stat1Value'] ?? null,
                    's1l' => $p['stat1Label'] ?? null,
                    's1l_en' => $p['stat1LabelEn'] ?? null,
                    's2v' => $p['stat2Value'] ?? null,
                    's2l' => $p['stat2Label'] ?? null,
                    's2l_en' => $p['stat2LabelEn'] ?? null,
                    's3v' => $p['stat3Value'] ?? null,
                    's3l' => $p['stat3Label'] ?? null,
                    's3l_en' => $p['stat3LabelEn'] ?? null,
                    'sort' => $i,
                ]);
            }

            $pdo->exec('DELETE FROM skills');
            $pdo->exec('DELETE FROM skill_categories');
            $insCat = $pdo->prepare('INSERT INTO skill_categories (name, name_en, sort_order) VALUES (:name, :name_en, :sort)');
            $insSkill = $pdo->prepare('INSERT INTO skills (category_id, name, level, level_en, sort_order) VALUES (:cat, :name, :level, :level_en, :sort)');
            foreach (($data['skills'] ?? []) as $ci => $cat) {
                $insCat->execute(['name' => $cat['name'] ?? '', 'name_en' => $cat['nameEn'] ?? null, 'sort' => $ci]);
                $catId = (int) $pdo->lastInsertId();
                foreach (($cat['items'] ?? []) as $si => $skill) {
                    $insSkill->execute([
                        'cat' => $catId,
                        'name' => $skill['name'] ?? '',
                        'level' => $skill['level'] ?? '',
                        'level_en' => $skill['levelEn'] ?? null,
                        'sort' => $si,
                    ]);
                }
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
                    'role' => $x['role'] ?? '',
                    'role_en' => $x['roleEn'] ?? null,
                    'org' => $x['org'] ?? '',
                    'org_en' => $x['orgEn'] ?? null,
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
                    'degree' => $x['degree'] ?? '',
                    'degree_en' => $x['degreeEn'] ?? null,
                    'org' => $x['org'] ?? '',
                    'org_en' => $x['orgEn'] ?? null,
                    'range' => format_date_range($eduStart, $eduEnd, 'es'),
                    'range_en' => format_date_range($eduStart, $eduEnd, 'en'),
                    'start_date' => $eduStart,
                    'end_date' => $eduEnd,
                    'status' => $x['status'] ?? '',
                    'status_en' => $x['statusEn'] ?? null,
                    'sort' => $i,
                ]);
            }

            $pdo->exec('DELETE FROM certifications');
            $insCert = $pdo->prepare('INSERT INTO certifications (name, name_en, issuer, issuer_en, issue_date, sort_order) VALUES (:name, :name_en, :issuer, :issuer_en, :issue_date, :sort)');
            foreach (($data['certifications'] ?? []) as $i => $c) {
                $insCert->execute([
                    'name' => $c['name'] ?? '',
                    'name_en' => $c['nameEn'] ?? null,
                    'issuer' => $c['issuer'] ?? '',
                    'issuer_en' => $c['issuerEn'] ?? null,
                    'issue_date' => iso_date_or_null($c['issueDate'] ?? null),
                    'sort' => $i,
                ]);
            }

            $contact = $data['contact'] ?? [];
            $stmt = $pdo->prepare('
                UPDATE contact_info SET availability_badge=:badge, availability_badge_en=:badge_en, portfolio_url=:portfolio_url
                WHERE id = 1
            ');
            $stmt->execute([
                'badge' => $contact['badge'] ?? '',
                'badge_en' => $contact['badgeEn'] ?? null,
                'portfolio_url' => safe_url($contact['portfolioUrl'] ?? ''),
            ]);

            $pdo->exec('DELETE FROM contacts');
            $insContact = $pdo->prepare('INSERT INTO contacts (label, label_en, value, sort_order) VALUES (:label, :label_en, :value, :sort)');
            foreach (($contact['items'] ?? []) as $i => $item) {
                $label = trim($item['label'] ?? '');
                $value = trim($item['value'] ?? '');
                if ($label === '' || $value === '') {
                    continue;
                }
                $insContact->execute([
                    'label' => $label,
                    'label_en' => $item['labelEn'] ?? null,
                    'value' => $value,
                    'sort' => $i,
                ]);
            }

            $pdo->exec('DELETE FROM social_links');
            $insSocial = $pdo->prepare('INSERT INTO social_links (url, sort_order) VALUES (:url, :sort)');
            foreach (($data['socialLinks'] ?? []) as $i => $link) {
                $url = safe_social_url($link['url'] ?? '');
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
        $newImages = array_column($data['projects'] ?? [], 'image');
        foreach (array_diff($oldImages, $newImages) as $orphan) {
            $path = UPLOAD_PROJECTS_DIR . '/' . basename($orphan);
            if (is_file($path)) {
                unlink($path);
            }
        }
    }

}
