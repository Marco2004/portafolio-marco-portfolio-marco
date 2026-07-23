<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

const TRUSTED_DEVICE_COOKIE = 'mpv_remember';
const SECURITY_LOG_PATH = ROOT_PATH . '/src/logs/security.log';

/**
 * Bitácora de eventos de autenticación (intentos fallidos, bloqueos,
 * solicitudes de reset, OTP, altas de cuenta) para poder reconstruir qué pasó
 * ante un reporte de "no puedo entrar" o un intento de acceso sospechoso.
 * Vive fuera del webroot servible: src/.htaccess ya bloquea todo src/ por
 * HTTP. Nunca se registran contraseñas, códigos ni tokens, solo metadatos.
 */
function log_security_event(string $event, array $context = []): void {
    $dir = dirname(SECURITY_LOG_PATH);
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'cli';
    $line = sprintf(
        '[%s] ip=%s event=%s %s%s',
        date('Y-m-d H:i:s'),
        $ip,
        $event,
        http_build_query($context, '', ' '),
        PHP_EOL
    );
    error_log($line, 3, SECURITY_LOG_PATH);
}

function start_session_if_needed(): void {
    if (session_status() === PHP_SESSION_NONE) {
        $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax',
            'secure' => $secure,
        ]);
        session_start();
    }
}

function ensure_session(): void {
    start_session_if_needed();
    enforce_session_idle_timeout();
}

function enforce_session_idle_timeout(): void {
    if (empty($_SESSION['admin_id'])) {
        return;
    }
    $last = $_SESSION['last_activity'] ?? time();
    if (time() - $last > SESSION_IDLE_TIMEOUT_MINUTES * 60) {
        do_logout();
        return;
    }
    $_SESSION['last_activity'] = time();
}

function is_logged_in(): bool {
    ensure_session();
    return !empty($_SESSION['admin_id']);
}

const ADMIN_GATE_COOKIE = 'mpv_admin_gate';

/**
 * Oculta /admin detrás de ADMIN_ACCESS_KEY (.env) para que nadie sin esa
 * clave sepa siquiera que el panel existe: responde 404 liso (no un 403, que
 * confirmaría la ruta) en vez de mostrar login.php a cualquier bot/escáner
 * que lo pruebe a ciegas — una capa extra sobre el login real (contraseña +
 * 2FA), no un reemplazo. Se visita una vez como
 * "login.php?key=LA_CLAVE" y desde ahí una cookie de un año recuerda el
 * navegador; no hay que repetir la clave en cada visita. No se usa en
 * reset-password.php/verify-email.php: esas páginas ya llegan con su propio
 * token de un solo uso mandado por correo, que cumple el mismo papel.
 */
/**
 * Ruta del cookie de la reja: se calcula a partir del propio request en vez
 * de un "/admin/" fijo — un "/admin/" fijo da por sentado que el proyecto
 * vive en la raíz del dominio. En XAMPP local (o cualquier hosting que sirva
 * el proyecto desde una subcarpeta, ej. "/portafolio-marco/admin/...") ese
 * valor fijo nunca coincide con la ruta real, así que el navegador jamás
 * reenvía el cookie — quedaba enmascarado mientras $_SESSION['admin_gate_ok']
 * siguiera viva, pero en cuanto la sesión se destruye (logout real, por
 * ejemplo) la reja vuelve a pedir la clave por URL cada vez, sin que el
 * cookie de un año sirva de nada. Mismo criterio que ya usan
 * forgot-password.php/setup.php/verify-email.php para construir enlaces
 * absolutos (dirname() sobre la URL actual, sin el query string).
 */
function admin_gate_cookie_path(): string {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    return rtrim(dirname($path), '/') . '/';
}

function require_admin_gate(): void {
    if (ADMIN_ACCESS_KEY === '') {
        return;
    }
    ensure_session();

    $key = $_GET['key'] ?? null;
    if ($key !== null) {
        if (!hash_equals(ADMIN_ACCESS_KEY, $key)) {
            log_security_event('admin_gate_denied');
            http_response_code(404);
            exit;
        }
        $_SESSION['admin_gate_ok'] = true;
        setcookie(ADMIN_GATE_COOKIE, hash('sha256', ADMIN_ACCESS_KEY), [
            'expires' => time() + 60 * 60 * 24 * 365,
            'path' => admin_gate_cookie_path(),
            'httponly' => true,
            'samesite' => 'Lax',
            'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        ]);
        // Redirige a la misma página sin "?key=..." apenas se guarda la
        // cookie — ya cumplió su propósito (quedó en el log del servidor de
        // todos modos, eso no se puede evitar) pero no hace falta que además
        // se quede en la URL visible del navegador ni que viaje en el header
        // Referer de los recursos que carga esa misma página (fuentes,
        // imágenes de terceros, etc.). Se conserva cualquier otro parámetro
        // ("?verified=1", etc.) — solo se quita "key".
        $remaining = $_GET;
        unset($remaining['key']);
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        header('Location: ' . $path . ($remaining ? ('?' . http_build_query($remaining)) : ''));
        exit;
    }

    if (!empty($_SESSION['admin_gate_ok'])) {
        return;
    }
    $cookie = $_COOKIE[ADMIN_GATE_COOKIE] ?? '';
    if ($cookie !== '' && hash_equals(hash('sha256', ADMIN_ACCESS_KEY), $cookie)) {
        $_SESSION['admin_gate_ok'] = true;
        return;
    }

    http_response_code(404);
    exit;
}

function require_login_page(string $loginUrl): void {
    if (!is_logged_in()) {
        header('Location: ' . $loginUrl);
        exit;
    }
}

function require_login_api(): void {
    if (!is_logged_in()) {
        json_response(['error' => 'No autenticado'], 401);
    }
}

function require_csrf(): void {
    ensure_session();
    $header = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $header)) {
        json_response(['error' => 'Token de seguridad inválido, recarga la página.'], 403);
    }
}

/**
 * CSRF para los formularios clásicos de auth (login, setup, forgot/reset
 * password, verify) — distinto de require_csrf()/$_SESSION['csrf'] de arriba,
 * que es para las llamadas fetch() del dashboard vía header. Estos forms
 * hacen POST normal con recarga completa, así que el token viaja como campo
 * oculto en vez de header.
 */
function csrf_field_token(): string {
    ensure_session();
    if (empty($_SESSION['form_csrf'])) {
        $_SESSION['form_csrf'] = bin2hex(random_bytes(16));
    }
    return $_SESSION['form_csrf'];
}

function verify_csrf_field(?string $token): bool {
    ensure_session();
    return !empty($_SESSION['form_csrf']) && !empty($token) && hash_equals($_SESSION['form_csrf'], $token);
}

/**
 * Política de contraseña del servidor — espejo de los "hard fail" del
 * medidor visual en admin/assets/js/password-strength.js (mismo criterio,
 * para que el botón deshabilitado en el cliente y el rechazo del servidor
 * coincidan siempre). Sigue NIST 800-63B: longitud mínima + lista negra de
 * contraseñas filtradas pesan más que exigir mayúscula/símbolo a la fuerza.
 * $context son valores (usuario, correo) contra los que no debe coincidir.
 */
function validate_password_strength(string $password, array $context = []): array {
    if (strlen($password) < 8) {
        return ['ok' => false, 'error' => 'La contraseña debe tener al menos 8 caracteres.'];
    }
    $lower = mb_strtolower($password);
    foreach ($context as $value) {
        $value = mb_strtolower(trim((string) $value));
        if ($value !== '' && strlen($value) >= 3 && str_contains($lower, $value)) {
            return ['ok' => false, 'error' => 'La contraseña no puede contener tu usuario o correo.'];
        }
    }
    if (in_array($lower, COMMON_PASSWORDS, true)) {
        return ['ok' => false, 'error' => 'Esa contraseña es demasiado común — elige una distinta.'];
    }
    if (preg_match('/^(.)\1+$/', $password)) {
        return ['ok' => false, 'error' => 'Evita caracteres repetidos como "aaaaaaaa".'];
    }
    $sequences = 'abcdefghijklmnopqrstuvwxyz0123456789';
    if (str_contains($sequences, $lower) || str_contains(strrev($sequences), $lower)) {
        return ['ok' => false, 'error' => 'Evita secuencias obvias como "12345678" o "abcdefgh".'];
    }
    return ['ok' => true, 'error' => null];
}

/**
 * Mismo subconjunto de contraseñas filtradas/reutilizadas que
 * password-strength.js del lado del cliente (ver ese archivo para la nota
 * completa) — se mantiene aquí en minúsculas para comparar directo.
 */
const COMMON_PASSWORDS = [
    '123456', 'password', '123456789', '12345678', '12345', '1234567',
    '1234567890', 'qwerty', 'abc123', '111111', '123123', 'letmein',
    'welcome', 'monkey', 'login', 'admin', 'iloveyou', '1q2w3e4r', '000000',
    'qwerty123', 'dragon', 'master', 'hello', 'freedom', 'whatever',
    'qazwsx', 'trustno1', '654321', 'superman', '1qaz2wsx', 'sunshine',
    'princess', 'football', 'shadow', 'michael', 'jennifer', 'jordan',
    'hunter', 'buster', 'harley', 'ranger', 'daniel', 'starwars', '112233',
    'george', 'computer', 'michelle', 'jessica', 'pepper', '1111', 'zxcvbn',
    '555555', '11111111', '131313', '123321', 'asdf', 'asdfgh',
    'qwertyuiop', 'passw0rd', 'p@ssw0rd', 'p@ssword', 'changeme', 'root',
    'toor', 'administrator', 'guest', 'test', 'test123', 'temp', 'temp123',
    'default', 'letmein123', 'baseball', 'soccer', 'batman', 'spiderman',
    'ninja', 'mustang', 'access', 'flower', 'hottie', 'loveme', 'biteme',
    'jesus', 'trustme', 'cheese', 'banana', 'purple', 'orange', 'yellow',
    'chicken', 'asdfasdf', '1234', '12345678910', 'welcome1', 'abcd1234',
    '1a2b3c4d', 'contraseña', 'contrasena', 'password1', 'password123',
];

/**
 * Registra un intento en $bucket para la IP actual y devuelve true si ya se
 * pasó de $maxHits dentro de los últimos $windowSeconds. A diferencia de un
 * cooldown guardado en $_SESSION (se evade limpiando cookies o abriendo una
 * ventana de incógnito), esto vive en la base de datos por IP.
 */
function rate_limit_hit(PDO $pdo, string $bucket, string $ip, int $maxHits, int $windowSeconds): bool {
    $pdo->prepare('INSERT INTO rate_limit_hits (bucket, ip) VALUES (:b, :ip)')->execute(['b' => $bucket, 'ip' => $ip]);

    $cutoff = date('Y-m-d H:i:s', time() - $windowSeconds);
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM rate_limit_hits WHERE bucket = :b AND ip = :ip AND created_at > :cutoff');
    $stmt->execute(['b' => $bucket, 'ip' => $ip, 'cutoff' => $cutoff]);
    $count = (int) $stmt->fetchColumn();

    // Limpieza oportunista de filas viejas (1 de cada ~20 llamadas) para que
    // la tabla no crezca sin límite — no hace falta un cron aparte para esto.
    if (random_int(1, 20) === 1) {
        $pdo->prepare('DELETE FROM rate_limit_hits WHERE created_at < :old')
            ->execute(['old' => date('Y-m-d H:i:s', time() - 86400)]);
    }

    return $count > $maxHits;
}

function admin_exists(PDO $pdo): bool {
    $stmt = $pdo->query('SELECT COUNT(*) FROM admin_users');
    return (int) $stmt->fetchColumn() > 0;
}

/**
 * Chequeos previos al INSERT de create_admin(), para mostrar un error
 * específico en setup.php en vez de dejar que la restricción UNIQUE de la
 * BD truene como una PDOException sin capturar (username ya la tenía;
 * email la ganó junto con esta función — ver database/schema.sql).
 */
function username_taken(PDO $pdo, string $username): bool {
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM admin_users WHERE username = :u');
    $stmt->execute(['u' => $username]);
    return (int) $stmt->fetchColumn() > 0;
}

function email_taken(PDO $pdo, string $email): bool {
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM admin_users WHERE email = :e');
    $stmt->execute(['e' => $email]);
    return (int) $stmt->fetchColumn() > 0;
}

function create_admin(PDO $pdo, string $username, string $email, string $password): int {
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare('INSERT INTO admin_users (username, email, password_hash) VALUES (:u, :e, :p)');
    $stmt->execute(['u' => $username, 'e' => $email, 'p' => $hash]);
    log_security_event('admin_account_created', ['username' => $username]);
    return (int) $pdo->lastInsertId();
}

/**
 * Paso 1 del login: valida usuario-o-correo + contraseña. NO abre sesión
 * todavía — eso pasa hasta que se confirme el código enviado por correo (ver
 * create_login_otp()/verify_login_otp()) o exista un dispositivo confiable.
 * Aplica bloqueo temporal tras varios intentos fallidos seguidos.
 *
 * Devuelve el motivo exacto del fallo (no_such_account/locked/bad_password)
 * en vez de solo null. Esto es una decisión consciente: para un sistema de
 * un solo administrador (no multiusuario), Marco pidió explícitamente
 * mensajes específicos ("no existe ese usuario", "contraseña incorrecta",
 * "cuenta bloqueada") en vez de uno genérico. La contraparte es que ya no
 * se previene la enumeración de cuentas (alguien podría probar usuarios/
 * correos y notar cuál existe) — se acepta ese riesgo porque solo hay una
 * cuenta real y el login sigue protegido por bloqueo temporal + OTP por
 * correo en el segundo paso.
 */
function verify_credentials(PDO $pdo, string $identifier, string $password): array {
    // Dos parámetros nombrados distintos aunque el valor sea el mismo: PDO
    // corre con EMULATE_PREPARES=false, y reusar el mismo nombre en dos
    // placeholders ("WHERE username = :i OR email = :i") revienta con
    // "Invalid parameter number" (bug real que ya se dio en este proyecto).
    $stmt = $pdo->prepare('SELECT * FROM admin_users WHERE username = :u OR email = :e LIMIT 1');
    $stmt->execute(['u' => $identifier, 'e' => $identifier]);
    $row = $stmt->fetch();
    if (!$row) {
        log_security_event('login_failed', ['identifier' => $identifier, 'reason' => 'no_such_account']);
        return ['admin' => null, 'reason' => 'not_found'];
    }
    if (is_locked_out($row)) {
        log_security_event('login_blocked', ['username' => $row['username'], 'reason' => 'locked_out']);
        return ['admin' => null, 'reason' => 'locked', 'locked_until' => $row['locked_until']];
    }
    if (!password_verify($password, $row['password_hash'])) {
        register_failed_attempt($pdo, (int) $row['id'], (int) $row['failed_attempts']);
        log_security_event('login_failed', ['username' => $row['username'], 'reason' => 'bad_password']);
        return ['admin' => null, 'reason' => 'bad_password'];
    }
    $pdo->prepare('UPDATE admin_users SET failed_attempts = 0, locked_until = NULL WHERE id = :id')
        ->execute(['id' => $row['id']]);
    return ['admin' => $row, 'reason' => null];
}

function is_locked_out(array $admin): bool {
    return !empty($admin['locked_until']) && strtotime($admin['locked_until']) > time();
}

function register_failed_attempt(PDO $pdo, int $adminId, int $currentAttempts): void {
    $attempts = $currentAttempts + 1;
    $lockedUntil = null;
    if ($attempts >= LOGIN_MAX_FAILED_ATTEMPTS) {
        $lockedUntil = date('Y-m-d H:i:s', time() + LOGIN_LOCKOUT_MINUTES * 60);
        $attempts = 0;
        log_security_event('account_locked', ['admin_id' => $adminId, 'minutes' => LOGIN_LOCKOUT_MINUTES]);
    }
    $stmt = $pdo->prepare('UPDATE admin_users SET failed_attempts = :a, locked_until = :l WHERE id = :id');
    $stmt->execute(['a' => $attempts, 'l' => $lockedUntil, 'id' => $adminId]);
}

/**
 * Paso 2 del login: código de 6 dígitos enviado por correo. Cualquier
 * código sin usar anterior para esa cuenta se invalida al generar uno nuevo.
 */
function create_login_otp(PDO $pdo, int $adminId): string {
    $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $hash = password_hash($code, PASSWORD_DEFAULT);
    $expires = date('Y-m-d H:i:s', time() + LOGIN_OTP_TTL_MINUTES * 60);

    $pdo->prepare("DELETE FROM auth_tokens WHERE admin_id = :id AND purpose = 'login_otp' AND consumed_at IS NULL")
        ->execute(['id' => $adminId]);
    $pdo->prepare("INSERT INTO auth_tokens (admin_id, purpose, token_hash, expires_at) VALUES (:id, 'login_otp', :hash, :exp)")
        ->execute(['id' => $adminId, 'hash' => $hash, 'exp' => $expires]);

    // Limpieza oportunista de tokens viejos de cualquier propósito (login_otp,
    // password_reset, email_verify) ya vencidos o consumidos — mismo patrón
    // que rate_limit_hit() para no necesitar un cron aparte. Se dispara aquí
    // porque create_login_otp() corre en cada intento de login, así que la
    // tabla no crece sin límite con el uso normal del panel.
    if (random_int(1, 20) === 1) {
        // Placeholder repetido (:old1/:old2 en vez de reusar :old): con
        // PDO::ATTR_EMULATE_PREPARES=false el driver nativo de MySQL no
        // permite el mismo named placeholder dos veces en una sola consulta.
        $cutoff = date('Y-m-d H:i:s', time() - 7 * 86400);
        $pdo->prepare('DELETE FROM auth_tokens WHERE expires_at < :old1 OR (consumed_at IS NOT NULL AND consumed_at < :old2)')
            ->execute(['old1' => $cutoff, 'old2' => $cutoff]);
    }

    return $code;
}

function verify_login_otp(PDO $pdo, int $adminId, string $code): bool {
    $stmt = $pdo->prepare("SELECT * FROM auth_tokens WHERE admin_id = :id AND purpose = 'login_otp' AND consumed_at IS NULL ORDER BY id DESC LIMIT 1");
    $stmt->execute(['id' => $adminId]);
    $row = $stmt->fetch();
    if (!$row || strtotime($row['expires_at']) < time() || (int) $row['attempts'] >= LOGIN_OTP_MAX_ATTEMPTS) {
        return false;
    }
    if (!password_verify($code, $row['token_hash'])) {
        $pdo->prepare('UPDATE auth_tokens SET attempts = attempts + 1 WHERE id = :id')->execute(['id' => $row['id']]);
        log_security_event('otp_failed', ['admin_id' => $adminId]);
        return false;
    }
    $pdo->prepare('UPDATE auth_tokens SET consumed_at = NOW() WHERE id = :id')->execute(['id' => $row['id']]);
    return true;
}

/**
 * Completa el login (después de OTP correcto, o de un dispositivo confiable
 * válido): regenera el ID de sesión y guarda el usuario en sesión.
 */
function complete_login(array $admin): void {
    ensure_session();
    session_regenerate_id(true);
    $_SESSION['admin_id'] = (int) $admin['id'];
    $_SESSION['admin_username'] = $admin['username'];
    $_SESSION['last_activity'] = time();
    unset($_SESSION['pending_admin_id']);
}

/* ---------- Recordar este dispositivo (30 días) ---------- */

function issue_trusted_device(PDO $pdo, int $adminId): void {
    $selector = bin2hex(random_bytes(9));
    $validator = bin2hex(random_bytes(33));
    $hash = password_hash($validator, PASSWORD_DEFAULT);
    $expires = date('Y-m-d H:i:s', time() + TRUSTED_DEVICE_DAYS * 86400);

    $pdo->prepare('INSERT INTO trusted_devices (admin_id, selector, validator_hash, expires_at) VALUES (:id, :sel, :hash, :exp)')
        ->execute(['id' => $adminId, 'sel' => $selector, 'hash' => $hash, 'exp' => $expires]);

    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    setcookie(TRUSTED_DEVICE_COOKIE, $selector . ':' . $validator, [
        'expires' => time() + TRUSTED_DEVICE_DAYS * 86400,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => $secure,
    ]);
}

/**
 * Si la cookie de dispositivo confiable es válida, devuelve la fila del
 * admin correspondiente; si no, null (incluye "no hay cookie").
 */
function check_trusted_device(PDO $pdo): ?array {
    if (empty($_COOKIE[TRUSTED_DEVICE_COOKIE])) {
        return null;
    }
    [$selector, $validator] = array_pad(explode(':', $_COOKIE[TRUSTED_DEVICE_COOKIE], 2), 2, '');
    if ($selector === '' || $validator === '') {
        return null;
    }
    $stmt = $pdo->prepare('SELECT * FROM trusted_devices WHERE selector = :sel LIMIT 1');
    $stmt->execute(['sel' => $selector]);
    $device = $stmt->fetch();
    if (!$device || strtotime($device['expires_at']) < time() || !password_verify($validator, $device['validator_hash'])) {
        return null;
    }
    $stmt = $pdo->prepare('SELECT * FROM admin_users WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $device['admin_id']]);
    return $stmt->fetch() ?: null;
}

function clear_trusted_device_cookie(?PDO $pdo = null): void {
    if (!empty($_COOKIE[TRUSTED_DEVICE_COOKIE])) {
        // También borra la fila en trusted_devices, no solo la cookie del
        // navegador — si no, el selector:validator seguía siendo un
        // credential válido por 30 días si alguien lo recuperaba después
        // (historial del navegador, perfil restaurado, etc.), contradiciendo
        // que "cerrar sesión" revoque el dispositivo confiable.
        if ($pdo !== null) {
            [$selector] = array_pad(explode(':', $_COOKIE[TRUSTED_DEVICE_COOKIE], 2), 2, '');
            if ($selector !== '') {
                $pdo->prepare('DELETE FROM trusted_devices WHERE selector = :sel')->execute(['sel' => $selector]);
            }
        }
        // Mismas opciones (httponly/samesite/secure) que set_trusted_device_cookie():
        // algunos navegadores no borran una cookie si los atributos no coinciden.
        $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
        setcookie(TRUSTED_DEVICE_COOKIE, '', [
            'expires' => time() - 3600,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax',
            'secure' => $secure,
        ]);
    }
}

/* ---------- Recuperar contraseña ---------- */

function create_password_reset_token(PDO $pdo, int $adminId): string {
    $token = bin2hex(random_bytes(32));
    $hash = password_hash($token, PASSWORD_DEFAULT);
    $expires = date('Y-m-d H:i:s', time() + PASSWORD_RESET_TTL_MINUTES * 60);

    $pdo->prepare("DELETE FROM auth_tokens WHERE admin_id = :id AND purpose = 'password_reset' AND consumed_at IS NULL")
        ->execute(['id' => $adminId]);
    $pdo->prepare("INSERT INTO auth_tokens (admin_id, purpose, token_hash, expires_at) VALUES (:id, 'password_reset', :hash, :exp)")
        ->execute(['id' => $adminId, 'hash' => $hash, 'exp' => $expires]);

    log_security_event('password_reset_requested', ['admin_id' => $adminId]);
    return $token;
}

/**
 * Busca entre los tokens de recuperación vigentes cuál corresponde al valor
 * recibido por URL (hay que probarlos todos porque están hasheados, no se
 * puede buscar por igualdad directa en SQL).
 */
function find_password_reset(PDO $pdo, string $token): ?array {
    $stmt = $pdo->prepare("SELECT * FROM auth_tokens WHERE purpose = 'password_reset' AND consumed_at IS NULL AND expires_at > NOW()");
    $stmt->execute();
    foreach ($stmt->fetchAll() as $row) {
        if (password_verify($token, $row['token_hash'])) {
            return $row;
        }
    }
    return null;
}

function consume_password_reset(PDO $pdo, int $tokenId, int $adminId, string $newPassword): void {
    $pdo->beginTransaction();
    try {
        $pdo->prepare('UPDATE admin_users SET password_hash = :h, failed_attempts = 0, locked_until = NULL WHERE id = :id')
            ->execute(['h' => password_hash($newPassword, PASSWORD_DEFAULT), 'id' => $adminId]);
        $pdo->prepare('UPDATE auth_tokens SET consumed_at = NOW() WHERE id = :id')->execute(['id' => $tokenId]);
        // Una contraseña olvidada puede significar cuenta comprometida:
        // invalida sesiones futuras vía dispositivos confiables y OTPs pendientes.
        $pdo->prepare('DELETE FROM trusted_devices WHERE admin_id = :id')->execute(['id' => $adminId]);
        $pdo->prepare("DELETE FROM auth_tokens WHERE admin_id = :id AND purpose = 'login_otp' AND consumed_at IS NULL")
            ->execute(['id' => $adminId]);
        $pdo->commit();
        log_security_event('password_reset_completed', ['admin_id' => $adminId]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

/* ---------- Verificación de correo (tras setup.php, antes del primer login) ---------- */

function create_email_verification_token(PDO $pdo, int $adminId): string {
    $token = bin2hex(random_bytes(32));
    $hash = password_hash($token, PASSWORD_DEFAULT);
    $expires = date('Y-m-d H:i:s', time() + EMAIL_VERIFY_TTL_MINUTES * 60);

    $pdo->prepare("DELETE FROM auth_tokens WHERE admin_id = :id AND purpose = 'email_verify' AND consumed_at IS NULL")
        ->execute(['id' => $adminId]);
    $pdo->prepare("INSERT INTO auth_tokens (admin_id, purpose, token_hash, expires_at) VALUES (:id, 'email_verify', :hash, :exp)")
        ->execute(['id' => $adminId, 'hash' => $hash, 'exp' => $expires]);

    return $token;
}

/**
 * Igual que find_password_reset(): hay que probar todos los tokens vigentes
 * porque están hasheados, no se puede buscar por igualdad directa en SQL.
 */
function find_email_verification(PDO $pdo, string $token): ?array {
    $stmt = $pdo->prepare("SELECT * FROM auth_tokens WHERE purpose = 'email_verify' AND consumed_at IS NULL AND expires_at > NOW()");
    $stmt->execute();
    foreach ($stmt->fetchAll() as $row) {
        if (password_verify($token, $row['token_hash'])) {
            return $row;
        }
    }
    return null;
}

function consume_email_verification(PDO $pdo, int $tokenId, int $adminId): void {
    $pdo->beginTransaction();
    try {
        $pdo->prepare('UPDATE admin_users SET email_verified_at = NOW() WHERE id = :id')->execute(['id' => $adminId]);
        $pdo->prepare('UPDATE auth_tokens SET consumed_at = NOW() WHERE id = :id')->execute(['id' => $tokenId]);
        $pdo->commit();
        log_security_event('email_verified', ['admin_id' => $adminId]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function do_logout(): void {
    start_session_if_needed();
    $_SESSION = [];
    session_destroy();
}
