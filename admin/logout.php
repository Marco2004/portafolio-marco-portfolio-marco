<?php
require_once __DIR__ . '/../src/auth.php';

require_admin_gate();

// Antes era un <a href="logout.php"> — un simple GET, sin token, cerraba la
// sesión: cualquier página ajena podía forzar el cierre de sesión del admin
// con solo un <img src="/admin/logout.php"> o similar (CSRF). El impacto era
// bajo (una desconexión forzada, no fuga de datos), pero no hay razón para
// dejarlo así pudiendo evitarlo. Ahora exige POST + el mismo token de
// formulario clásico que login.php/setup.php (ver csrf_field_token() en
// src/auth.php) — el link de la barra lateral (admin/index.php) ahora es un
// <form method="post"> con ese token, visualmente igual que antes.
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !verify_csrf_field($_POST['csrf_token'] ?? null)) {
    header('Location: index.php');
    exit;
}

$pdo = get_pdo();

do_logout();
// El logout manual también debe revocar "recordar este dispositivo" — antes
// solo un cambio de contraseña lo invalidaba, así que la cookie de 30 días
// sobrevivía a un cierre de sesión explícito. Se pasa $pdo para borrar
// también la fila en trusted_devices, no solo la cookie del navegador.
clear_trusted_device_cookie($pdo);
header('Location: login.php');
exit;
