<?php
require_once __DIR__ . '/../src/auth.php';
require_once __DIR__ . '/../src/helpers.php';
require_once __DIR__ . '/../src/Mailer.php';

require_admin_gate();

$pdo = get_pdo();

if (admin_exists($pdo)) {
    header('Location: login.php');
    exit;
}

$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $email = trim($_POST['email'] ?? '');
    // trim() en la contraseña: un espacio accidental al inicio/final (común al
    // copiar/pegar o en teclados móviles) no debe volverse parte de la
    // contraseña real — se aplica igual aquí (al crearla) que en login.php y
    // reset-password.php (al verificarla/cambiarla) para que nunca queden
    // desincronizados.
    $password = trim((string) ($_POST['password'] ?? ''));
    $confirm = trim((string) ($_POST['confirm'] ?? ''));

    if (!verify_csrf_field($_POST['csrf_token'] ?? null)) {
        $error = 'Token de seguridad inválido — recarga la página e intenta de nuevo.';
    } elseif ($username === '' || strlen($username) < 3) {
        $error = 'El usuario debe tener al menos 3 caracteres.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error = 'Escribe un correo electrónico válido — ahí llegarán tus códigos de acceso.';
    } elseif (username_taken($pdo, $username)) {
        $error = 'Ese nombre de usuario ya está en uso.';
    } elseif (email_taken($pdo, $email)) {
        $error = 'Ya existe una cuenta con ese correo.';
    } elseif (!($strength = validate_password_strength($password, [$username, $email]))['ok']) {
        $error = $strength['error'];
    } elseif ($password !== $confirm) {
        $error = 'Las contraseñas no coinciden.';
    } else {
        $adminId = create_admin($pdo, $username, $email, $password);
        // La cuenta NO queda utilizable todavía: hay que confirmar el correo
        // primero (verify-email.php) — login.php bloquea el acceso mientras
        // email_verified_at sea NULL. El correo de bienvenida se envía hasta
        // que se confirme, no aquí.
        $token = create_email_verification_token($pdo, $adminId);
        $verifyUrl = site_url(dirname($_SERVER['REQUEST_URI']) . '/verify-email.php?token=' . $token);
        email_verification($email, $verifyUrl);
        ensure_session();
        $_SESSION['pending_verify_admin_id'] = $adminId;
        header('Location: verify-email.php');
        exit;
    }
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
<script src="<?= asset_url('assets/js/theme-antiflash.js') ?>"></script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Crear cuenta de administrador — Portafolio Web</title>
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
      <span class="login-card__bar-label">primer-arranque</span>
    </div>
    <div class="login-card__body">
      <div class="login-card__header">
        <span class="login-card__logo">M</span>
        <div>
          <p class="login-card__title">Crear cuenta de administrador</p>
          <p class="login-card__subtitle">Se ejecuta solo la primera vez</p>
        </div>
      </div>
      <form class="login-form" method="post">
        <input type="hidden" name="csrf_token" value="<?= e(csrf_field_token()) ?>">
        <div class="field">
          <label for="username">Usuario</label>
          <input type="text" id="username" name="username" autocomplete="username" required minlength="3" value="<?= e($_POST['username'] ?? '') ?>">
        </div>
        <div class="field">
          <label for="email">Correo electrónico</label>
          <input type="email" id="email" name="email" autocomplete="email" required placeholder="tu@correo.com" value="<?= e($_POST['email'] ?? '') ?>">
        </div>
        <div class="field">
          <label for="password">Contraseña</label>
          <div class="password-input">
            <input type="password" id="password" name="password" autocomplete="new-password" required minlength="8"
              data-strength-input data-strength-context="#username,#email">
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
        <button type="submit" class="login-submit">Crear cuenta</button>
        <p class="login-hint">Cada inicio de sesión te va a pedir un código que llega a ese correo. Este formulario desaparece en cuanto exista una cuenta.</p>
      </form>
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
