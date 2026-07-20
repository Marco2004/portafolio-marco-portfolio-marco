<?php
require_once __DIR__ . '/../src/auth.php';
require_once __DIR__ . '/../src/Mailer.php';

require_admin_gate();

$pdo = get_pdo();
ensure_session();

if (is_logged_in()) {
    header('Location: index.php');
    exit;
}

if (empty($_SESSION['pending_admin_id'])) {
    header('Location: login.php');
    exit;
}

$adminId = (int) $_SESSION['pending_admin_id'];
$stmt = $pdo->prepare('SELECT * FROM admin_users WHERE id = :id LIMIT 1');
$stmt->execute(['id' => $adminId]);
$admin = $stmt->fetch();

if (!$admin) {
    unset($_SESSION['pending_admin_id']);
    header('Location: login.php');
    exit;
}

$error = null;
$notice = isset($_GET['mail_error']) ? 'No se pudo enviar el correo con el código — revisa BREVO_API_KEY/MAIL_FROM_EMAIL en tu .env. Si ya lo arreglaste, pide un código nuevo.' : null;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !verify_csrf_field($_POST['csrf_token'] ?? null)) {
    $error = 'Token de seguridad inválido — recarga la página e intenta de nuevo.';
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'resend') {
    // El cooldown de 60s de $_SESSION no evita que alguien que ya conoce (o
    // adivinó) la contraseña vuelva a enviarla una y otra vez — cada envío
    // exitoso de login.php arma una sesión nueva con su propio cooldown en
    // ceros, así que sin este límite por IP podría mandar códigos sin freno
    // al correo real del admin. Mismo patrón que forgot-password.php.
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    if (rate_limit_hit($pdo, 'login_otp_resend', $ip, 5, 15 * 60)) {
        $error = 'Demasiados intentos desde esta conexión — espera unos minutos e intenta de nuevo.';
    } else {
        $lastSent = $_SESSION['otp_last_sent'] ?? 0;
        if (time() - $lastSent < 60) {
            $notice = 'Espera unos segundos antes de pedir otro código.';
        } else {
            $code = create_login_otp($pdo, $adminId);
            email_login_otp($admin['email'], $code);
            $_SESSION['otp_last_sent'] = time();
            $notice = 'Te enviamos un código nuevo.';
        }
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'verify') {
    $code = trim($_POST['code'] ?? '');
    if (verify_login_otp($pdo, $adminId, $code)) {
        $remember = !empty($_POST['remember']);
        complete_login($admin);
        if ($remember) {
            issue_trusted_device($pdo, $adminId);
        }
        email_new_login_notice($admin['email'], [
            'ip' => $_SERVER['REMOTE_ADDR'] ?? 'desconocida',
            'userAgent' => $_SERVER['HTTP_USER_AGENT'] ?? 'desconocido',
            'remembered' => $remember,
        ]);
        header('Location: index.php');
        exit;
    }
    $error = 'Código incorrecto o vencido.';
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
<script src="<?= asset_url('assets/js/theme-antiflash.js') ?>"></script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Verificar código — Panel de administración</title>
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
      <span class="login-card__bar-label">verificación en dos pasos</span>
    </div>
    <div class="login-card__body">
      <div class="login-card__header">
        <span class="login-card__logo">M</span>
        <div>
          <p class="login-card__title">Revisa tu correo</p>
          <p class="login-card__subtitle">Te enviamos un código a <?= e($admin['email']) ?></p>
        </div>
      </div>
      <form class="login-form" method="post">
        <input type="hidden" name="action" value="verify">
        <input type="hidden" name="csrf_token" value="<?= e(csrf_field_token()) ?>">
        <div class="field">
          <label for="code">Código de 6 dígitos</label>
          <input type="text" id="code" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" autofocus required>
        </div>
        <label class="checkbox-field">
          <input type="checkbox" name="remember" value="1">
          Recordar este dispositivo por 30 días
        </label>
        <?php if ($notice): ?>
          <p class="login-hint login-hint--accent"><?= e($notice) ?></p>
        <?php endif; ?>
        <?php if ($error): ?>
          <p class="login-error" role="alert"><?= e($error) ?></p>
        <?php endif; ?>
        <button type="submit" class="login-submit">Verificar</button>
      </form>
      <form method="post" class="u-mt-10">
        <input type="hidden" name="action" value="resend">
        <input type="hidden" name="csrf_token" value="<?= e(csrf_field_token()) ?>">
        <button type="submit" class="login-link-btn">Reenviar código</button>
      </form>
      <p class="login-hint"><a href="login.php">Cancelar y volver al login</a></p>
    </div>
  </div>
</div>
<script src="<?= asset_url('assets/js/admin-icons.js') ?>" defer></script>
<script src="<?= asset_url('assets/js/auth-theme-toggle.js') ?>" defer></script>
<script src="<?= asset_url('assets/js/form-validate.js') ?>" defer></script>
<script src="<?= asset_url('assets/js/form-loading.js') ?>" defer></script>
</body>
</html>
