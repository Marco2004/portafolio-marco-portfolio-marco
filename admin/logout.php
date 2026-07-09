<?php
require_once __DIR__ . '/../src/auth.php';

require_admin_gate();

$pdo = get_pdo();

do_logout();
// El logout manual también debe revocar "recordar este dispositivo" — antes
// solo un cambio de contraseña lo invalidaba, así que la cookie de 30 días
// sobrevivía a un cierre de sesión explícito. Se pasa $pdo para borrar
// también la fila en trusted_devices, no solo la cookie del navegador.
clear_trusted_device_cookie($pdo);
header('Location: login.php');
exit;
