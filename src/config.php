<?php
// Configuración central del sitio. Los valores reales (credenciales de BD,
// API de correo) viven en ".env" (en la raíz del proyecto, fuera de git) —
// este archivo solo define las constantes que el resto del código usa, con
// defaults seguros para desarrollo local si ".env" no existe.

// Nunca mostrar errores/warnings de PHP en la respuesta HTTP — un error no
// controlado podría filtrar rutas del servidor, consultas SQL o nombres de
// columnas a cualquier visitante. Se registran en el log de PHP en su lugar
// (ver php.ini > error_log) para poder diagnosticarlos sin exponerlos.
// Se fuerza aquí porque XAMPP trae display_errors=On por defecto a nivel de
// php.ini, pensado para desarrollo local, no para lo que se sirve por HTTP.
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

/**
 * Carga pares KEY=VALUE de un archivo ".env" simple hacia getenv()/$_ENV.
 * No sobreescribe una variable que ya exista en el entorno (permite que el
 * hosting real inyecte sus propias env vars sin que ".env" las pise).
 */
function load_env_file(string $path): void {
    if (!is_file($path) || !is_readable($path)) {
        return;
    }
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
            continue;
        }
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim(trim($value), "\"'");
        if ($key !== '' && getenv($key) === false) {
            putenv($key . '=' . $value);
            $_ENV[$key] = $value;
        }
    }
}

function env(string $key, string $default = ''): string {
    $value = getenv($key);
    return $value === false ? $default : $value;
}

load_env_file(dirname(__DIR__) . '/.env');

define('DB_HOST', env('DB_HOST', '127.0.0.1'));
define('DB_NAME', env('DB_NAME', 'portafolio'));
define('DB_USER', env('DB_USER', 'root'));
define('DB_PASS', env('DB_PASS', '')); // XAMPP trae MySQL sin contraseña por defecto en root.

define('ROOT_PATH', dirname(__DIR__));
define('UPLOAD_PROJECTS_DIR', ROOT_PATH . '/public/uploads/projects');

define('MAX_IMAGE_BYTES', 5 * 1024 * 1024); // 5 MB

define('SITE_NAME', env('SITE_NAME', 'Portafolio Web'));

// Base pública del sitio (ej. "https://midominio.com") para construir los
// links absolutos que se mandan por correo (recuperación de contraseña,
// verificación de correo — ver site_url() en helpers.php). Sin esto, esos
// links se construían con el header Host de la petición entrante, que el
// visitante controla: alguien podría forjar un Host falso al pedir "Olvidé
// mi contraseña" y el correo (real, al admin real) llegaría con un link que
// apunta al dominio del atacante en vez del sitio real. Vacío por default en
// desarrollo local (XAMPP no tiene un dominio público fijo); site_url() cae
// de regreso al Host de la petición solo en ese caso.
define('SITE_URL', rtrim(env('SITE_URL', ''), '/'));

// Clave secreta para acceder a /admin (ver require_admin_gate() en
// src/auth.php) — sin ella, cualquier URL bajo /admin/ responde 404 como si
// no existiera, para que un bot/escáner que prueba "/admin/login.php" a
// ciegas no tenga forma de saber que el panel existe. Vacía por default: en
// desarrollo local no bloquea nada (no vale la pena teclear la clave en cada
// prueba en XAMPP); en producción, ponerla en ".env" (nunca en este archivo).
define('ADMIN_ACCESS_KEY', env('ADMIN_ACCESS_KEY', ''));

// Envío de correo (verificación de correo, códigos de acceso, recuperación de
// contraseña) vía la API HTTP de Brevo (https://www.brevo.com, plan gratuito:
// 300 correos/día) en vez de SMTP — los hosts gratuitos (ej. Google Cloud)
// suelen bloquear los puertos SMTP salientes, pero nunca el puerto 443/HTTPS
// que usa esta API (ver send_email() en src/Mailer.php). Crea una cuenta
// gratis, verifica un "remitente individual" (tu correo) y genera una API
// key en Panel > SMTP & API > API Keys — ponla en BREVO_API_KEY dentro de
// ".env", NUNCA en este archivo.
define('BREVO_API_KEY', env('BREVO_API_KEY', ''));
define('MAIL_FROM_EMAIL', env('MAIL_FROM_EMAIL', '')); // debe ser el correo verificado en Brevo.
define('MAIL_FROM_NAME', env('MAIL_FROM_NAME', SITE_NAME));

define('LOGIN_OTP_TTL_MINUTES', 10);
define('LOGIN_OTP_MAX_ATTEMPTS', 5);
define('LOGIN_MAX_FAILED_ATTEMPTS', 5);
define('LOGIN_LOCKOUT_MINUTES', 15);
define('TRUSTED_DEVICE_DAYS', 30);
define('PASSWORD_RESET_TTL_MINUTES', 30);
define('EMAIL_VERIFY_TTL_MINUTES', 60);
define('SESSION_IDLE_TIMEOUT_MINUTES', 30);
