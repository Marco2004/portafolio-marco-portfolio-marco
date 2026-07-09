<?php

/**
 * Arma una URL absoluta hacia el sitio (usada en los correos de
 * recuperación de contraseña/verificación, ver admin/forgot-password.php,
 * setup.php, verify-email.php). Usa SITE_URL si está configurado
 * (config.php); si no, cae de regreso al Host de la petición entrante —
 * solo aceptable en desarrollo local, donde no hay un dominio público fijo
 * que configurar y nadie más comparte el servidor.
 */
function site_url(string $path): string {
    if (SITE_URL !== '') {
        return SITE_URL . $path;
    }
    return 'http://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $path;
}

/**
 * Script anti-flash para el <head> del Dashboard y las páginas de auth
 * (login/setup/forgot-password/reset-password/verify/verify-email). Se
 * resuelve antes de pintar nada: elección manual guardada de forma
 * permanente en el navegador (localStorage, botón de tema del dashboard o
 * del sitio público — misma clave "mpv_theme" para ambos) > preferencia del
 * sistema operativo > oscuro (si el navegador no expone
 * prefers-color-scheme). Solo se usa el sistema operativo como default la
 * primera vez, antes de que exista una elección manual guardada; no hay
 * default de base de datos — el tema nunca es algo configurado por el admin
 * para otros visitantes (eso no existe, ver el punto de la pestaña
 * Apariencia eliminada). Se imprime igual en las 7 páginas en vez de un
 * <script src> aparte porque debe ejecutarse en línea, antes de que se pinte
 * cualquier CSS.
 */
function theme_antiflash_script(): string {
    return '<script>(function(){try{var m=localStorage.getItem("mpv_theme");if(m==="dark"||m==="light"){document.documentElement.setAttribute("data-theme",m);}else if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches){document.documentElement.setAttribute("data-theme","light");}else{document.documentElement.setAttribute("data-theme","dark");}}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();</script>';
}

/**
 * Nombres de mes en español/inglés para las fechas de Experiencia,
 * Certificaciones y Educación (punto 6) — el admin ya no escribe el texto
 * a mostrar a mano, se genera siempre a partir de la fecha real capturada
 * con el datepicker DD/MM/AA (ver admin/assets/js/admin-datepicker.js, que
 * repite este mismo arreglo en JS para la vista previa antes de guardar).
 */
const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * "Mes de Año" (mes con mayúscula inicial por ir solo, como encabezado de un
 * rango — ej. "Febrero de 2026") — usado para el rango de Experiencia y
 * Educación, que ya se mostraba así (mes abreviado + año) antes de este
 * cambio; ahora se calcula solo, sin escribirlo dos veces.
 */
function format_es_month_year(?string $iso, string $lang = 'es'): string {
    if (!$iso) {
        return '';
    }
    $ts = strtotime($iso);
    if ($ts === false) {
        return '';
    }
    $m = (int) date('n', $ts) - 1;
    $y = date('Y', $ts);
    if ($lang === 'en') {
        return MONTHS_EN[$m] . ' ' . $y;
    }
    return ucfirst(MONTHS_ES[$m]) . ' de ' . $y;
}

/**
 * "D de mes de Año" en minúsculas (correcto en español — a diferencia del
 * inglés, los meses no se escriben con mayúscula dentro de una fecha
 * completa) — ej. "12 de febrero de 2026". Usado para Certificaciones, que
 * es una fecha puntual (no un rango).
 */
function format_es_date_long(?string $iso, string $lang = 'es'): string {
    if (!$iso) {
        return '';
    }
    $ts = strtotime($iso);
    if ($ts === false) {
        return '';
    }
    $d = (int) date('j', $ts);
    $m = (int) date('n', $ts) - 1;
    $y = date('Y', $ts);
    if ($lang === 'en') {
        return MONTHS_EN[$m] . ' ' . $d . ', ' . $y;
    }
    return $d . ' de ' . MONTHS_ES[$m] . ' de ' . $y;
}

/**
 * Rango "Mes de Año — Mes de Año" (o "— Presente"/"— Present" si no hay
 * fecha de fin) para Experiencia y Educación — reemplaza el campo de texto
 * libre que antes obligaba a escribir la fecha dos veces.
 */
function format_date_range(?string $start, ?string $end, string $lang = 'es'): string {
    $startText = format_es_month_year($start, $lang);
    if ($startText === '') {
        return '';
    }
    if (!$end) {
        return $startText . ($lang === 'en' ? ' — Present' : ' — Presente');
    }
    return $startText . ' — ' . format_es_month_year($end, $lang);
}

function json_response($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * json_encode pensado para incrustarse dentro de un <script type="application/json">.
 * json_encode() sin JSON_UNESCAPED_SLASHES ya escapa "/" por defecto (así
 * "</script>" dentro de un valor —texto editado por el admin— no puede
 * cerrar la etiqueta antes de tiempo): NO hay que volver a escapar "/" a
 * mano encima de eso. Hacerlo (como hacía esta función antes) duplica el
 * escape en cada "/" ya escapado y corrompe progresivamente cualquier valor
 * con barras (URLs de LinkedIn/GitHub) un poco más en cada guardado.
 */
function json_encode_for_script(array $data): string {
    $json = json_encode($data, JSON_UNESCAPED_UNICODE);
    return $json === false ? '{}' : $json;
}

/**
 * Agrega "?v=<fecha de modificación real del archivo>" a una URL de CSS/JS
 * local para que el navegador deje de servir una copia cacheada en cuanto el
 * archivo cambie en el servidor. El proyecto no tiene build step ni nombres
 * de archivo versionados, así que sin esto un cambio de estilos/JS podía no
 * verse hasta un refresco forzado (Ctrl+Shift+R) — parecía que el cambio
 * "no se aplicó" cuando en realidad el navegador solo estaba usando la copia
 * vieja. $href se resuelve relativo a la carpeta del script actual (funciona
 * igual desde admin/index.php que desde public/index.php).
 */
function asset_url(string $href): string {
    $full = dirname($_SERVER['SCRIPT_FILENAME']) . '/' . $href;
    $v = @filemtime($full);
    return $href . '?v=' . ($v ?: '1');
}

function json_input(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function csv_to_array(string $s): array {
    $parts = array_map('trim', explode(',', $s));
    return array_values(array_filter($parts, fn($p) => $p !== ''));
}

function array_to_csv(array $a): string {
    return implode(', ', array_map('trim', $a));
}

function lines_to_array(string $s): array {
    $parts = preg_split('/\r\n|\r|\n/', $s);
    $parts = array_map('trim', $parts);
    return array_values(array_filter($parts, fn($p) => $p !== ''));
}

function array_to_lines(array $a): string {
    return implode("\n", array_map('trim', $a));
}

function e(?string $s): string {
    return htmlspecialchars($s ?? '', ENT_QUOTES, 'UTF-8');
}

/**
 * Iconos SVG en línea (stroke, currentColor) para la interfaz de admin.
 * Se usan en vez de emoji porque el glifo de emoji varía entre sistema
 * operativo/navegador (algunos ni siquiera lo tienen, ej. el de "apagar"),
 * lo que rompía la alineación vertical con el texto de al lado.
 */
function icon(string $name): string {
    $paths = [
        'home' => '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
        'folder' => '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Z"/>',
        'brain' => '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M8.5 9.5h7M8.5 14.5h7"/>',
        'briefcase' => '<rect x="3" y="7.5" width="18" height="12" rx="1.5"/><path d="M8 7.5V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1.5"/><path d="M3 12.5h18"/>',
        'graduation-cap' => '<path d="M2 9.5 12 5l10 4.5-10 4.5-10-4.5Z"/><path d="M6 11.7V16c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4.3"/>',
        'mail' => '<rect x="3" y="5.5" width="18" height="13" rx="1.5"/><path d="m4 7 8 6 8-6"/>',
        'file-text' => '<path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v4h4M8.5 12.5h7M8.5 16h5"/>',
        'palette' => '<path d="M12 3a9 8 0 1 0 0 16c1.1 0 1.8-.9 1.8-1.9 0-.5-.2-.9-.5-1.3-.3-.3-.5-.7-.5-1.2 0-.9.8-1.6 1.7-1.6H16a4 3.7 0 0 0 4-3.7C20 5.8 16.4 3 12 3Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7.5" r="1"/><circle cx="14.5" cy="7.5" r="1"/>',
        'external-link' => '<path d="M9 6h9v9"/><path d="M18 6 6 18"/>',
        'log-out' => '<path d="M9 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H9"/><path d="M14 16l4-4-4-4"/><path d="M18 12H8"/>',
        'menu' => '<path d="M3 6h18M3 12h18M3 18h18"/>',
        'save' => '<path d="M5 3h11l3 3v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M8 3v6h8V3M7 21v-7h10v7"/>',
        'globe' => '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.4 3.8 5.5 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.5-3.8-9S9.5 5.4 12 3Z"/>',
        'grip' => '<circle cx="9" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="15" cy="18" r="1.3"/>',
        'eye' => '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
        'eye-off' => '<path d="M3 3l18 18"/><path d="M10.6 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a15.6 15.6 0 0 1-3.2 4.1M6.5 7.4C4 9.1 2.5 12 2.5 12s3.5 6.5 9.5 6.5a9.6 9.6 0 0 0 3.4-.6"/><path d="M9.9 10a3 3 0 0 0 4.2 4.2"/>',
        'expand' => '<path d="M9 4H4v5M15 4h5v5M4 15v5h5M20 15v5h-5"/>',
        'compress' => '<path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5"/>',
        'chevron-left' => '<path d="M15 5 8 12l7 7"/>',
        'chevron-right' => '<path d="M9 5l7 7-7 7"/>',
        'sun' => '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7"/>',
        'moon' => '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>',
        'monitor' => '<rect x="3" y="4.5" width="18" height="12" rx="1.5"/><path d="M8.5 20h7M12 16.5V20"/>',
        // Íconos de plataformas para los links sociales (ver detect_social_platform()) —
        // trazos simplificados en el mismo estilo minimalista del resto del set, no
        // logotipos oficiales pixel-perfect.
        'linkedin' => '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r=".9" fill="currentColor" stroke="none"/><path d="M8 11.2V17"/><path d="M13 17v-4a2 2 0 0 1 4 0v4"/><path d="M13 17v-5.8"/>',
        'twitter-x' => '<path d="M4.5 4.5l15 15M19.5 4.5l-15 15"/>',
        'instagram' => '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/>',
        'youtube' => '<rect x="2.5" y="6" width="19" height="12" rx="4"/><path d="M10.5 9.7v4.6l4.3-2.3Z" fill="currentColor" stroke="none"/>',
        'whatsapp' => '<path d="M12 3a9 9 0 0 0-7.75 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z"/><path d="M8.6 9.1c0 4 2.4 6.4 6.4 6.4.5 0 1-.4 1.1-.9l.1-.7c.1-.4-.1-.7-.4-.9l-1.3-.7c-.3-.2-.6-.1-.9.1l-.4.4c-.9-.5-1.6-1.2-2.1-2.1l.4-.4c.2-.3.3-.6.1-.9l-.7-1.3c-.2-.3-.5-.5-.9-.4l-.7.1c-.5.1-.9.6-.7 1.3Z" fill="currentColor" stroke="none"/>',
        'telegram' => '<circle cx="12" cy="12" r="9.3"/><path d="M6.3 12.1l11.2-4.6-2.9 11.3-3.4-3.9-2.6 1.9Z" fill="currentColor" stroke="none"/>',
        'tiktok' => '<path d="M13.8 3v10.8a3.3 3.3 0 1 1-2.8-3.3"/><path d="M13.8 3c.3 2.3 2 4 4.3 4.3"/>',
        'facebook' => '<path d="M15 8.2h2V4.3h-2.2c-2.7 0-4.3 1.6-4.3 4.3v2.2H8v3.8h2.5V21h3.8v-6.4H17l.4-3.8h-3.1V8.9c0-.4.3-.7.7-.7Z" fill="currentColor" stroke="none"/>',
        'github-mark' => '<path d="M12 2.2c-5.5 0-10 4.5-10 10 0 4.4 2.9 8.2 6.8 9.5.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.7.4-1.1.6-1.4-2.2-.2-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.2-.5-1.3.1-2.7 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .6 1.4.2 2.5.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.8-4.6 5 .4.3.7.9.7 1.9v2.7c0 .3.2.6.7.5 4-1.3 6.8-5.1 6.8-9.5 0-5.5-4.5-10-10-10Z" fill="currentColor" stroke="none"/>',
        'dribbble' => '<circle cx="12" cy="12" r="9"/><path d="M4.2 9.6c4 1.2 8.6 1.2 15.1-1.1"/><path d="M6 19.2c1.9-5.1 5-9.2 12.1-10.8"/><path d="M12.2 3.1c3 4.1 4.5 8.3 3.9 17.4"/>',
        'link' => '<path d="M9.5 14.5 14.5 9.5"/><path d="M11 6.5l1-1a4 4 0 0 1 5.5 5.5l-1.5 1.5"/><path d="M13 17.5l-1 1a4 4 0 0 1-5.5-5.5l1.5-1.5"/>',
        // Mismo trazo que el ícono 'mail' de arriba — reutilizado como plataforma
        // "Email" en los chips de redes sociales (ver detect_social_platform()).
        'email' => '<rect x="3" y="5.5" width="18" height="13" rx="1.5"/><path d="m4 7 8 6 8-6"/>',
    ];
    $inner = $paths[$name] ?? '';
    return '<svg class="icon icon--' . e($name) . '" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' . $inner . '</svg>';
}

/**
 * Detecta la plataforma de un link social por su dominio, para mostrar el
 * ícono y la etiqueta correctos sin que el admin tenga que elegirlos a mano
 * — solo pega la URL en el dashboard (ver admin-social-links.js). Cualquier
 * dominio no reconocido cae al ícono/etiqueta genérico "Enlace".
 */
function detect_social_platform(string $url): array {
    if (preg_match('#^mailto:#i', $url)) {
        return ['icon' => 'email', 'label' => 'Email'];
    }

    $host = mb_strtolower((string) parse_url($url, PHP_URL_HOST));
    $host = preg_replace('/^www\./', '', $host ?? '');

    $map = [
        'linkedin.com' => ['icon' => 'linkedin', 'label' => 'LinkedIn'],
        'github.com' => ['icon' => 'github-mark', 'label' => 'GitHub'],
        'twitter.com' => ['icon' => 'twitter-x', 'label' => 'X (Twitter)'],
        'x.com' => ['icon' => 'twitter-x', 'label' => 'X (Twitter)'],
        'instagram.com' => ['icon' => 'instagram', 'label' => 'Instagram'],
        'facebook.com' => ['icon' => 'facebook', 'label' => 'Facebook'],
        'fb.com' => ['icon' => 'facebook', 'label' => 'Facebook'],
        'youtube.com' => ['icon' => 'youtube', 'label' => 'YouTube'],
        'youtu.be' => ['icon' => 'youtube', 'label' => 'YouTube'],
        'wa.me' => ['icon' => 'whatsapp', 'label' => 'WhatsApp'],
        'whatsapp.com' => ['icon' => 'whatsapp', 'label' => 'WhatsApp'],
        't.me' => ['icon' => 'telegram', 'label' => 'Telegram'],
        'telegram.org' => ['icon' => 'telegram', 'label' => 'Telegram'],
        'tiktok.com' => ['icon' => 'tiktok', 'label' => 'TikTok'],
        'dribbble.com' => ['icon' => 'dribbble', 'label' => 'Dribbble'],
    ];

    return $map[$host] ?? ['icon' => 'link', 'label' => $host !== '' ? $host : 'Enlace'];
}

/**
 * Para la sección de Contacto (lista libre de {label, value}, ver punto 11):
 * si el valor se ve como correo o teléfono se enlaza como mailto:/tel:, si
 * no se muestra como texto plano sin enlace — un tipo de contacto genérico
 * ("Discord", "Ubicación"...) no tiene un esquema de URL razonable.
 */
function contact_link_href(string $value): ?string {
    $value = trim($value);
    if (preg_match('/^[^@\s]+@[^@\s]+\.[^@\s]+$/', $value)) {
        return 'mailto:' . $value;
    }
    if (preg_match('/^[+()0-9][0-9()\s.\-]{5,}$/', $value)) {
        return 'tel:' . preg_replace('/[^0-9+]/', '', $value);
    }
    return null;
}

/**
 * Devuelve el texto en inglés si el admin ya lo tradujo, si no cae de
 * regreso al español (para que nada se vea vacío mientras se va traduciendo).
 */
function t(?string $es, ?string $en, string $lang): string {
    if ($lang === 'en' && $en !== null && trim($en) !== '') {
        return $en;
    }
    return $es ?? '';
}

/**
 * Valida que una URL guardada desde el dashboard (LinkedIn, GitHub, demo de
 * un proyecto...) use un esquema http/https antes de usarla en un atributo
 * href. e() por sí solo escapa entidades HTML pero no bloquea esquemas como
 * "javascript:" — esto evita que un valor mal escrito ahí se ejecute al
 * hacer clic. Devuelve '' (enlace inofensivo a la misma página) si no pasa.
 */
function safe_url(?string $url): string {
    $url = trim($url ?? '');
    if ($url === '' || !preg_match('#^https?://#i', $url)) {
        return '';
    }
    return $url;
}

/**
 * Igual que safe_url() pero para los links de "Redes sociales" del Inicio,
 * donde además de http(s) también se acepta mailto: (para el chip "Email",
 * ver detect_social_platform()). Si el admin pegó una dirección de correo
 * suelta sin el prefijo mailto:, se normaliza aquí antes de guardar.
 */
function safe_social_url(?string $url): string {
    $url = trim($url ?? '');
    if ($url === '') {
        return '';
    }
    if (preg_match('/^[^@\s]+@[^@\s]+\.[^@\s]+$/', $url)) {
        return 'mailto:' . $url;
    }
    if (preg_match('#^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$#i', $url)) {
        return $url;
    }
    return safe_url($url);
}

/**
 * Igual que t() pero para listas (viñetas, métricas, idiomas). Empareja por
 * índice; si la línea en inglés en esa posición falta, usa la española.
 */
function t_list(array $es, array $en, string $lang): array {
    if ($lang !== 'en' || empty($en)) {
        return $es;
    }
    $out = [];
    foreach ($es as $i => $line) {
        $out[] = ($en[$i] ?? '') !== '' ? $en[$i] : $line;
    }
    return $out;
}

/**
 * Atributos data-i18n-dynamic/data-es/data-en listos para pegar en una
 * etiqueta HTML, para que i18n.js pueda intercambiar el texto sin recargar
 * la página. Uso: <p<?= dyn_attrs($hero['desc'], $hero['descEn']) ?>>...
 */
function dyn_attrs(?string $es, ?string $en): string {
    return ' data-i18n-dynamic data-es="' . e($es) . '" data-en="' . e(t($es, $en, 'en')) . '"';
}

/**
 * Valida la fecha ISO (YYYY-MM-DD) que manda el datepicker DD/MM/AA del
 * dashboard (ver admin/assets/js/admin-datepicker.js) antes de guardarla —
 * null si viene vacía o no es una fecha real (ej. 31 de febrero).
 */
function iso_date_or_null(?string $value): ?string {
    $value = trim($value ?? '');
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $m)) {
        return null;
    }
    return checkdate((int) $m[2], (int) $m[3], (int) $m[1]) ? $value : null;
}

function strip_url_scheme(string $url): string {
    return preg_replace('#^(https?://(www\.)?|mailto:)#i', '', $url);
}

function skill_level_pill_class(string $level): string {
    $l = mb_strtolower($level);
    if (str_contains($l, 'intermedio') || str_contains($l, 'avanzado')) {
        return 'level-pill--green';
    }
    if (str_contains($l, 'básico') || str_contains($l, 'basico')) {
        return 'level-pill--amber';
    }
    return 'level-pill--neutral';
}

/**
 * Valida una imagen subida ($_FILES[...]) contra whitelist de MIME y tamaño máximo.
 * Devuelve ['ok' => bool, 'error' => ?string, 'ext' => ?string].
 */
function validate_image_upload(array $file): array {
    $allowed = [
        'image/png' => 'png',
        'image/jpeg' => 'jpg',
        'image/webp' => 'webp',
    ];
    if (!isset($file['error']) || $file['error'] !== UPLOAD_ERR_OK) {
        return ['ok' => false, 'error' => 'Error al subir el archivo', 'ext' => null];
    }
    if ($file['size'] > MAX_IMAGE_BYTES) {
        return ['ok' => false, 'error' => 'La imagen supera el tamaño máximo (5 MB)', 'ext' => null];
    }
    $mime = mime_content_type($file['tmp_name']);
    if (!isset($allowed[$mime])) {
        return ['ok' => false, 'error' => 'Formato no permitido. Usa PNG, JPG o WEBP', 'ext' => null];
    }
    return ['ok' => true, 'error' => null, 'ext' => $allowed[$mime]];
}


/**
 * Mueve un archivo subido a $destDir con un nombre nuevo generado (nunca el
 * nombre original del usuario), y devuelve el nombre de archivo final.
 */
function save_uploaded_file(array $file, string $destDir, string $extension): string {
    if (!is_dir($destDir)) {
        mkdir($destDir, 0775, true);
    }
    $filename = bin2hex(random_bytes(12)) . '.' . $extension;
    $dest = $destDir . '/' . $filename;
    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        throw new RuntimeException('No se pudo guardar el archivo subido');
    }
    return $filename;
}
