<?php
require_once __DIR__ . '/../src/auth.php';
require_once __DIR__ . '/../src/Mailer.php';

require_admin_gate();

$pdo = get_pdo();

if (!admin_exists($pdo)) {
    header('Location: setup.php');
    exit;
}

if (is_logged_in()) {
    header('Location: index.php');
    exit;
}

// Si ya hay un dispositivo confiable válido y el usuario trae la sesión
// "pendiente" de un login anterior, no tiene sentido pedirle credenciales
// de nuevo — pero por defecto siempre se pide usuario/contraseña primero.
$error = null;
$justVerified = isset($_GET['verified']);

// Límite por IP además del bloqueo ya existente por cuenta
// (register_failed_attempt()/is_locked_out(), más abajo vía
// verify_credentials()) — ese bloqueo es por cuenta, así que no frena a
// alguien probando muchos usuarios/correos distintos desde la misma
// conexión. Se cuenta cada POST, exista o no la cuenta, mismo criterio que
// el resto de los formularios de autenticación.
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$loginIpThrottled = $_SERVER['REQUEST_METHOD'] === 'POST' && rate_limit_hit($pdo, 'login_attempt', $ip, 20, 15 * 60);

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !verify_csrf_field($_POST['csrf_token'] ?? null)) {
    $error = 'Token de seguridad inválido — recarga la página e intenta de nuevo.';
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && $loginIpThrottled) {
    $error = 'Demasiados intentos desde esta conexión — espera unos minutos e intenta de nuevo.';
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    // trim() para que un espacio accidental al inicio/final no cause un
    // "contraseña incorrecta" fantasma — ver el mismo trim() en setup.php.
    $password = trim((string) ($_POST['password'] ?? ''));
    $result = verify_credentials($pdo, $username, $password);
    $admin = $result['admin'];

    if (!$admin) {
        $looksLikeEmail = str_contains($username, '@');
        switch ($result['reason']) {
            case 'not_found':
                $error = $looksLikeEmail
                    ? 'No existe ninguna cuenta con ese correo.'
                    : 'No existe ninguna cuenta con ese usuario.';
                break;
            case 'locked':
                $minutes = max(1, (int) ceil((strtotime($result['locked_until']) - time()) / 60));
                $error = 'Esta cuenta está bloqueada temporalmente por varios intentos fallidos. Intenta de nuevo en ' . $minutes . ' minuto' . ($minutes === 1 ? '' : 's') . '.';
                break;
            case 'bad_password':
            default:
                $error = 'La contraseña no es correcta.';
                break;
        }
    } elseif (empty($admin['email_verified_at'])) {
        // No se genera OTP ni sesión mientras el correo no esté confirmado —
        // ver verify-email.php (flujo disparado desde setup.php).
        ensure_session();
        $_SESSION['pending_verify_admin_id'] = (int) $admin['id'];
        header('Location: verify-email.php');
        exit;
    } else {
        $trusted = check_trusted_device($pdo);
        if ($trusted && (int) $trusted['id'] === (int) $admin['id']) {
            complete_login($admin);
            email_new_login_notice($admin['email'], [
                'ip' => $_SERVER['REMOTE_ADDR'] ?? 'desconocida',
                'userAgent' => $_SERVER['HTTP_USER_AGENT'] ?? 'desconocido',
                'remembered' => true,
            ]);
            header('Location: index.php');
            exit;
        }

        $code = create_login_otp($pdo, (int) $admin['id']);
        $sent = email_login_otp($admin['email'], $code);

        ensure_session();
        $_SESSION['pending_admin_id'] = (int) $admin['id'];
        $_SESSION['otp_last_sent'] = time();

        if (!$sent) {
            header('Location: verify.php?mail_error=1');
        } else {
            header('Location: verify.php');
        }
        exit;
    }
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
<script src="<?= asset_url('assets/js/theme-antiflash.js') ?>"></script>
<?php render_head_meta(['title' => 'Iniciar sesión — Panel de administración']) ?>
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
      <span class="login-card__bar-label">admin-login</span>
    </div>
    <div class="login-card__body">
      <div class="login-card__header">
        <span class="login-card__logo">M</span>
        <div>
          <p class="login-card__title">Panel de administración</p>
          <p class="login-card__subtitle">Portafolio Web</p>
        </div>
      </div>
      <form class="login-form" method="post">
        <input type="hidden" name="csrf_token" value="<?= e(csrf_field_token()) ?>">
        <div class="field">
          <label for="username">Usuario o correo</label>
          <input type="text" id="username" name="username" autocomplete="username" autofocus required value="<?= e($_POST['username'] ?? '') ?>">
        </div>
        <div class="field">
          <label for="password">Contraseña</label>
          <div class="password-input">
            <input type="password" id="password" name="password" autocomplete="current-password" required>
            <button type="button" class="password-toggle" data-password-toggle aria-label="Mostrar contraseña">
              <span class="password-toggle__icon password-toggle__icon--show"><?= icon('eye') ?></span>
              <span class="password-toggle__icon password-toggle__icon--hide"><?= icon('eye-off') ?></span>
            </button>
          </div>
        </div>
        <?php if ($justVerified): ?>
          <p class="login-hint login-hint--success">Correo verificado. Ya puedes iniciar sesión.</p>
        <?php endif; ?>
        <?php if ($error): ?>
          <p class="login-error" role="alert"><?= e($error) ?></p>
        <?php endif; ?>
        <button type="submit" class="login-submit">Iniciar sesión</button>
        <p class="login-hint"><a href="forgot-password.php">¿Olvidaste tu contraseña?</a></p>
      </form>
    </div>
  </div>
</div>
<script src="<?= asset_url('assets/js/admin-icons.js') ?>" defer></script>
<script src="<?= asset_url('assets/js/auth-theme-toggle.js') ?>" defer></script>
<script src="<?= asset_url('assets/js/password-toggle.js') ?>" defer></script>
<script src="<?= asset_url('assets/js/form-validate.js') ?>" defer></script>
<script src="<?= asset_url('assets/js/form-loading.js') ?>" defer></script>
</body>
</html>
