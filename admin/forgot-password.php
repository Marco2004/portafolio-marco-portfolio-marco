<?php
require_once __DIR__ . '/../src/auth.php';
require_once __DIR__ . '/../src/Mailer.php';

require_admin_gate();

$pdo = get_pdo();

if (is_logged_in()) {
    header('Location: index.php');
    exit;
}

$sent = false;
$error = null;
$accountNotFound = false;

// Nota de seguridad: a partir de aquí se muestran mensajes explícitos según
// exista o no la cuenta ("ese usuario no existe" / "ese correo no está
// asociado a ninguna cuenta"), a petición directa de Marco — antes se
// mostraba siempre el mismo mensaje ambiguo como medida anti-enumeración.
// Para este proyecto personal de un solo administrador esa protección no
// aporta mucho (solo hay una cuenta posible) y a cambio confundía al probar
// el flujo, así que se revierte a propósito. El límite por IP de abajo
// sigue aplicando para que esto no se pueda usar para espamear correos ni
// para sondear identificadores sin freno.
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    ensure_session();
    $identifier = trim($_POST['identifier'] ?? '');
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    // Máximo 5 solicitudes cada 15 minutos por IP — se cuenta este intento
    // sin importar si el identificador existe o no, para que sondear
    // usuarios/correos tampoco quede sin freno.
    $ipThrottled = rate_limit_hit($pdo, 'password_reset', $ip, 5, 15 * 60);

    if (!verify_csrf_field($_POST['csrf_token'] ?? null)) {
        $error = 'Token de seguridad inválido. Recarga la página e intenta de nuevo.';
    } elseif ($identifier === '') {
        $error = 'Escribe tu usuario o correo.';
    } elseif ($ipThrottled) {
        $error = 'Demasiados intentos desde esta conexión — espera unos minutos e intenta de nuevo.';
    } else {
        $looksLikeEmail = str_contains($identifier, '@');
        $stmt = $pdo->prepare('SELECT * FROM admin_users WHERE username = :u OR email = :e LIMIT 1');
        $stmt->execute(['u' => $identifier, 'e' => $identifier]);
        $admin = $stmt->fetch();

        if (!$admin) {
            $error = $looksLikeEmail
                ? 'Ese correo no está asociado a ninguna cuenta.'
                : 'Ese usuario no existe.';
            // El link a "Registra una cuenta" solo tiene sentido si de
            // verdad no hay ningún admin todavía — este es un sistema de un
            // solo administrador, así que si ya existe uno, setup.php
            // redirige de vuelta a login.php y el link sería un callejón
            // sin salida. En ese caso el problema real es un typo, no que
            // falte registrarse.
            $accountNotFound = !admin_exists($pdo);
        } else {
            // Cooldown de 60s (mismo patrón que el reenvío de OTP en
            // verify.php) para no reenviar el correo en cada refresh.
            $lastSent = $_SESSION['reset_last_sent'] ?? 0;
            if (time() - $lastSent >= 60) {
                $token = create_password_reset_token($pdo, (int) $admin['id']);
                $resetUrl = site_url(dirname($_SERVER['REQUEST_URI']) . '/reset-password.php?token=' . $token);
                email_password_reset_link($admin['email'], $resetUrl);
                $_SESSION['reset_last_sent'] = time();
            }
            $sent = true;
        }
    }
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
<?= theme_antiflash_script() ?>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Recuperar contraseña — Panel de administración</title>
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
      <span class="login-card__bar-label">recuperar-acceso</span>
    </div>
    <div class="login-card__body">
      <div class="login-card__header">
        <span class="login-card__logo">M</span>
        <div>
          <p class="login-card__title">Recuperar contraseña</p>
          <p class="login-card__subtitle">Portafolio Web</p>
        </div>
      </div>
      <?php if ($sent): ?>
        <p class="login-hint" style="color:var(--green);">Te enviamos instrucciones por correo. Revisa tu bandeja de entrada (y spam).</p>
        <p class="login-hint"><a href="login.php">Volver al login</a></p>
      <?php else: ?>
        <form class="login-form" method="post">
          <input type="hidden" name="csrf_token" value="<?= e(csrf_field_token()) ?>">
          <div class="field">
            <label for="identifier">Usuario o correo</label>
            <input type="text" id="identifier" name="identifier" autocomplete="username" autofocus required value="<?= e($_POST['identifier'] ?? '') ?>">
          </div>
          <?php if ($error): ?>
            <p class="login-error" role="alert"><?= e($error) ?></p>
          <?php endif; ?>
          <button type="submit" class="login-submit">Enviar instrucciones</button>
          <?php if ($accountNotFound): ?>
            <p class="login-hint"><a href="setup.php">Registra una cuenta</a> · <a href="login.php">Volver al login</a></p>
          <?php else: ?>
            <p class="login-hint"><a href="login.php">Volver al login</a></p>
          <?php endif; ?>
        </form>
      <?php endif; ?>
    </div>
  </div>
</div>
<script src="<?= asset_url('assets/js/admin-icons.js') ?>" defer></script>
<script src="<?= asset_url('assets/js/auth-theme-toggle.js') ?>" defer></script>
<script src="<?= asset_url('assets/js/form-validate.js') ?>" defer></script>
<script src="<?= asset_url('assets/js/form-loading.js') ?>" defer></script>
</body>
</html>
