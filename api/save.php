<?php
require_once __DIR__ . '/../src/auth.php';
require_once __DIR__ . '/../src/Portfolio.php';

require_login_api();
require_csrf();

$pdo = get_pdo();

// Límite generoso (muy por encima de cualquier uso real del dashboard) para
// que una sesión comprometida no pueda usarse para golpear la base de datos
// sin freno — mismo mecanismo que ya protege login/reset/verify, ver
// rate_limit_hit() en src/auth.php.
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
if (rate_limit_hit($pdo, 'api_save', $ip, 60, 5 * 60)) {
    json_response(['error' => 'Demasiadas solicitudes seguidas. Espera unos minutos e intenta de nuevo.'], 429);
}

$data = json_input();

if (empty($data['hero']) || !isset($data['projects'])) {
    json_response(['error' => 'Datos incompletos'], 422);
}

$limitError = validate_save_payload_limits($data);
if ($limitError !== null) {
    json_response(['error' => $limitError], 422);
}

try {
    Portfolio::saveAll($pdo, $data);
} catch (Throwable $e) {
    // El detalle real (columna/consulta que falló) se registra en servidor,
    // nunca en la respuesta — podría revelar la estructura de la base de
    // datos a quien esté autenticado pero no debería ver eso.
    error_log('save.php failed: ' . $e->getMessage());
    json_response(['error' => 'No se pudo guardar. Intenta de nuevo; si sigue fallando, revisa el log del servidor.'], 500);
}

json_response(['ok' => true]);
