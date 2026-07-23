<?php
require_once __DIR__ . '/../src/auth.php';

require_login_api();
require_csrf();

// Mismo mecanismo y criterio que api/save.php: límite generoso para que una
// sesión comprometida no pueda usarse para subir archivos sin freno.
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
if (rate_limit_hit(get_pdo(), 'api_upload_image', $ip, 30, 5 * 60)) {
    json_response(['error' => 'Demasiadas solicitudes seguidas. Espera unos minutos e intenta de nuevo.'], 429);
}

if (empty($_FILES['file'])) {
    json_response(['error' => 'No se recibió ningún archivo'], 422);
}

$check = validate_image_upload($_FILES['file']);
if (!$check['ok']) {
    json_response(['error' => $check['error']], 422);
}

try {
    $filename = save_uploaded_file($_FILES['file'], UPLOAD_PROJECTS_DIR, $check['ext']);
} catch (Throwable $e) {
    json_response(['error' => 'No se pudo guardar la imagen'], 500);
}

json_response(['path' => $filename]);
