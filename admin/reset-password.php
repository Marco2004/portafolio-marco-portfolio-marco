<?php
require_once __DIR__ . '/../src/auth.php';
require_once __DIR__ . '/../src/Mailer.php';

$pdo = get_pdo();

if (is_logged_in()) {
    header('Location: index.php');
    exit;
}

$token = trim($_GET['token'] ?? $_POST['token'] ?? '');
$error = null;
$done = false;

$tokenRow = $token !== '' ? find_password_reset($pdo, $token) : null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verify_csrf_field($_POST['csrf_token'] ?? null)) {
        $error = 'Token de seguridad inválido — recarga la página e intenta de nuevo.';
    } elseif (!$tokenRow) {
        $error = 'Este enlace ya no es válido — pide uno nuevo.';
    } else {
        // trim() por la misma razón que en setup.php/login.php: un espacio
        // accidental no debe volverse parte de la contraseña.
        $password = trim((string) ($_POST['password'] ?? ''));
        $confirm = trim((string) ($_POST['confirm'] ?? ''));
        $tokenAdmin = $pdo->prepare('SELECT username, email FROM admin_users WHERE id = :id LIMIT 1');
        $tokenAdmin->execute(['id' => $tokenRow['admin_id']]);
        $tokenAdminRow = $tokenAdmin->fetch() ?: ['username' => '', 'email' => ''];

        if (!($strength = validate_password_strength($password, [$tokenAdminRow['username'], $tokenAdminRow['email']]))['ok']) {
            $error = $strength['error'];
        } elseif ($password !== $confirm) {
            $error = 'Las contraseñas no coinciden.';
        } else {
            consume_password_reset($pdo, (int) $tokenRow['id'], (int) $tokenRow['admin_id'], $password);
            if (!empty($tokenAdminRow['email'])) {
                email_password_reset_confirmed($tokenAdminRow['email']);
            }
            $done = true;
        }
    }
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
<script src="<?= asset_url('assets/js/theme-antiflash.js') ?>"></script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Restablecer contraseña — Panel de administración</title>
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
      <span class="login-card__bar-label">nueva-contraseña</span>
    </div>
    <div class="login-card__body">
      <div class="login-card__header">
        <span class="login-card__logo">M</span>
        <div>
          <p class="login-card__title">Restablecer contraseña</p>
          <p class="login-card__subtitle">Portafolio Web</p>
        </div>
      </div>

      <?php if ($done): ?>
        <p class="login-hint login-hint--success">Contraseña actualizada. Ya puedes iniciar sesión — por seguridad, cerramos todos los dispositivos recordados.</p>
        <p class="login-hint"><a href="login.php">Ir al login</a></p>
      <?php elseif (!$tokenRow): ?>
        <p class="login-error" role="alert">Este enlace venció o ya se usó.</p>
        <p class="login-hint"><a href="forgot-password.php">Pedir un enlace nuevo</a></p>
      <?php else: ?>
        <form class="login-form" method="post">
          <input type="hidden" name="token" value="<?= e($token) ?>">
          <input type="hidden" name="csrf_token" value="<?= e(csrf_field_token()) ?>">
          <div class="field">
            <label for="password">Nueva contraseña</label>
            <div class="password-input">
              <input type="password" id="password" name="password" autocomplete="new-password" required minlength="8" autofocus data-strength-input>
              <button type="button" class="password-toggle" data-password-toggle aria-label="Mostrar contraseña">
                <span class="password-toggle__icon password-toggle__icon--show"><?= icon('eye') ?></span>
                <span class="password-toggle__icon password-toggle__icon--hide"><?= icon('eye-off') ?></span>
              </button>
            </div>
            <div class="password-strength" data-password-strength hidden>
              <div class="password-strength__bar" data-password-strength-fill>
                <span></span><span></span><span></span><span></span><span></span>
              </div>
              <p class="password-strength__label" data-password-strength-label></p>
            </div>
          </div>
          <div class="field">
            <label for="confirm">Confirmar contraseña</label>
            <div class="password-input">
              <input type="password" id="confirm" name="confirm" autocomplete="new-password" required minlength="8">
              <button type="button" class="password-toggle" data-password-toggle aria-label="Mostrar contraseña">
                <span class="password-toggle__icon password-toggle__icon--show"><?= icon('eye') ?></span>
                <span class="password-toggle__icon password-toggle__icon--hide"><?= icon('eye-off') ?></span>
              </button>
            </div>
          </div>
          <?php if ($error): ?>
            <p class="login-error" role="alert"><?= e($error) ?></p>
          <?php endif; ?>
          <button type="submit" class="login-submit">Guardar nueva contraseña</button>
        </form>
      <?php endif; ?>
    </div>
  </div>
</div>
<script src="<?= asset_url('assets/js/admin-icons.js') ?>" defer></script>
<script src="<?= asset_url('assets/js/auth-theme-toggle.js') ?>" defer></script>
<script src="<?= asset_url('assets/js/password-toggle.js') ?>" defer></script>
<script src="<?= asset_url('assets/js/password-strength.js') ?>" defer></script>
<script src="<?= asset_url('assets/js/form-validate.js') ?>" defer></script>
<script src="<?= asset_url('assets/js/form-loading.js') ?>" defer></script>
</body>
</html>
