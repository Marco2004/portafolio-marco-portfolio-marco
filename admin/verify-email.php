<?php
require_once __DIR__ . '/../src/auth.php';
require_once __DIR__ . '/../src/helpers.php';
require_once __DIR__ . '/../src/Mailer.php';

$pdo = get_pdo();
ensure_session();

if (is_logged_in()) {
    header('Location: index.php');
    exit;
}

$token = trim($_GET['token'] ?? '');
$error = null;
$done = false;
$notice = null;

/**
 * De dónde sale el admin "pendiente" a verificar cuando no viene un token en
 * la URL (pantalla de "revisa tu correo" justo después de setup.php, o al
 * volver a cargar esa pantalla): primero la sesión (la puso setup.php),
 * si no existe se cae al único admin_users sin verificar — este es un
 * sistema de un solo administrador, así que no hay ambigüedad ni riesgo real
 * de enumeración adicional al que ya asume el resto del login.
 */
function pending_unverified_admin(PDO $pdo): ?array {
    if (!empty($_SESSION['pending_verify_admin_id'])) {
        $stmt = $pdo->prepare('SELECT * FROM admin_users WHERE id = :id AND email_verified_at IS NULL LIMIT 1');
        $stmt->execute(['id' => $_SESSION['pending_verify_admin_id']]);
        $row = $stmt->fetch();
        if ($row) {
            return $row;
        }
    }
    $stmt = $pdo->query('SELECT * FROM admin_users WHERE email_verified_at IS NULL ORDER BY id DESC LIMIT 1');
    return $stmt->fetch() ?: null;
}

if ($token !== '') {
    $tokenRow = find_email_verification($pdo, $token);
    if (!$tokenRow) {
        $error = 'Este enlace de verificación venció o ya se usó.';
    } else {
        $stmt = $pdo->prepare('SELECT * FROM admin_users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $tokenRow['admin_id']]);
        $admin = $stmt->fetch();
        consume_email_verification($pdo, (int) $tokenRow['id'], (int) $tokenRow['admin_id']);
        if ($admin) {
            email_welcome($admin['email'], $admin['username']);
        }
        unset($_SESSION['pending_verify_admin_id']);
        header('Location: login.php?verified=1');
        exit;
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'resend' && !verify_csrf_field($_POST['csrf_token'] ?? null)) {
    $error = 'Token de seguridad inválido — recarga la página e intenta de nuevo.';
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'resend') {
    $admin = pending_unverified_admin($pdo);
    // El cooldown de 60s de abajo vive en $_SESSION — cualquiera puede
    // evadirlo pidiendo esta página sin enviar cookies (nueva sesión en cada
    // solicitud) y así mandar correos de verificación sin límite al admin
    // real. Este límite por IP (misma función que forgot-password.php) no se
    // puede evadir así porque vive en la base de datos, no en la sesión.
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $ipThrottled = rate_limit_hit($pdo, 'email_verify_resend', $ip, 5, 15 * 60);
    if (!$admin) {
        $error = 'No hay ninguna verificación de correo pendiente.';
    } elseif ($ipThrottled) {
        $error = 'Demasiados intentos desde esta conexión — espera unos minutos e intenta de nuevo.';
    } else {
        $lastSent = $_SESSION['email_verify_last_sent'] ?? 0;
        if (time() - $lastSent < 60) {
            $notice = 'Espera unos segundos antes de pedir otro enlace.';
        } else {
            $newToken = create_email_verification_token($pdo, (int) $admin['id']);
            $verifyUrl = site_url(dirname($_SERVER['REQUEST_URI']) . '/verify-email.php?token=' . $newToken);
            email_verification($admin['email'], $verifyUrl);
            $_SESSION['email_verify_last_sent'] = time();
            $notice = 'Te enviamos un nuevo enlace de verificación.';
        }
    }
}

$pendingAdmin = pending_unverified_admin($pdo);
?>
<!DOCTYPE html>
<html lang="es">
<head>
<script src="<?= asset_url('assets/js/theme-antiflash.js') ?>"></script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Verifica tu correo — Panel de administración</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= asset_url('assets/css/normalize.css') ?>">
<link rel="stylesheet" href="<?= asset_url('assets/css/admin-base.css') ?>">
<link rel="stylesheet" href="<?= asset_url('assets/css/admin-login.css') ?>">
</head>
<body>
<button type="button" class="auth-theme-toggle" data-theme-toggle title="Cambiar tema claro/oscuro" aria-label="Cambiar tema">
  <span class="theme-toggle-icon" data-theme-icon></span><span data-theme-label>Oscuro</span>
</button>
<div class="login-screen">
  <div class="login-card">
    <div class="login-card__bar">
      <span class="traffic-lights"><span></span><span></span><span></span></span>
      <span class="login-card__bar-label">verificar-correo</span>
    </div>
    <div class="login-card__body">
      <div class="login-card__header">
        <span class="login-card__logo">M</span>
        <div>
          <p class="login-card__title">Revisa tu correo</p>
          <p class="login-card__subtitle"><?= $pendingAdmin ? 'Te enviamos un enlace a ' . e($pendingAdmin['email']) : 'Confirma tu cuenta para continuar' ?></p>
        </div>
      </div>

      <p class="login-hint u-mb-14">
        Antes de iniciar sesión necesitas confirmar tu correo electrónico. Da clic en el enlace que te enviamos — vence en <?= EMAIL_VERIFY_TTL_MINUTES ?> minutos.
      </p>

      <?php if ($notice): ?>
        <p class="login-hint login-hint--accent"><?= e($notice) ?></p>
      <?php endif; ?>
      <?php if ($error): ?>
        <p class="login-error" role="alert"><?= e($error) ?></p>
      <?php endif; ?>

      <?php if ($pendingAdmin): ?>
        <form method="post" class="u-mt-6">
          <input type="hidden" name="action" value="resend">
          <input type="hidden" name="csrf_token" value="<?= e(csrf_field_token()) ?>">
          <button type="submit" class="login-link-btn">Reenviar enlace de verificación</button>
        </form>
      <?php endif; ?>
      <p class="login-hint u-mt-10"><a href="login.php">Volver al login</a></p>
    </div>
  </div>
</div>
<script src="<?= asset_url('assets/js/admin-icons.js') ?>" defer></script>
<script src="<?= asset_url('assets/js/auth-theme-toggle.js') ?>" defer></script>
<script src="<?= asset_url('assets/js/form-loading.js') ?>" defer></script>
</body>
</html>
