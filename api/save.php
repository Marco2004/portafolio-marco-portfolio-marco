<?php
require_once __DIR__ . '/../src/auth.php';
require_once __DIR__ . '/../src/Portfolio.php';

require_login_api();
require_csrf();

$pdo = get_pdo();
$data = json_input();

if (empty($data['hero']) || !isset($data['projects'])) {
    json_response(['error' => 'Datos incompletos'], 422);
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
