<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php'; // solo para log_security_event() — auth.php nunca incluye este archivo, sin dependencia circular.

/**
 * Envía un correo vía la API HTTP de Brevo (ver BREVO_API_KEY en .env) en vez
 * de SMTP — los hosts gratuitos (Google Cloud, etc.) suelen bloquear los
 * puertos SMTP salientes, pero no el puerto 443/HTTPS que usa esta API.
 * Devuelve false en vez de lanzar una excepción — el llamador decide qué
 * mostrar al usuario si el envío falla (API key mal configurada, sin
 * internet, cuota agotada, etc.), igual que antes con SMTP.
 */
function send_email(string $to, string $subject, string $htmlBody): bool {
    if (BREVO_API_KEY === '' || MAIL_FROM_EMAIL === '') {
        log_security_event('mail_send_failed', ['reason' => 'brevo_not_configured']);
        return false;
    }

    $payload = json_encode([
        'sender' => ['name' => MAIL_FROM_NAME, 'email' => MAIL_FROM_EMAIL],
        'to' => [['email' => $to]],
        'subject' => $subject,
        'htmlContent' => $htmlBody,
        'textContent' => strip_tags($htmlBody),
    ]);

    $ch = curl_init('https://api.brevo.com/v3/smtp/email');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => [
            'api-key: ' . BREVO_API_KEY,
            'Content-Type: application/json',
            'Accept: application/json',
        ],
        CURLOPT_RETURNTRANSFER => true,
        // Cortos a propósito: una API de correo caída o lenta no debe colgar
        // una petición de login/setup del panel — el usuario ve el flujo de
        // "?mail_error" y puede reintentar en vez de esperar indefinidamente.
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 10,
    ]);
    $response = curl_exec($ch);
    $curlError = curl_error($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response === false || $status < 200 || $status >= 300) {
        // No se loguea $payload/$response completos: podrían incluir el
        // asunto/cuerpo del correo (código OTP, link de reset) en texto
        // plano dentro de la bitácora de seguridad.
        log_security_event('mail_send_failed', ['status' => $status, 'curl_error' => $curlError]);
        return false;
    }
    return true;
}

/**
 * Plantilla HTML compartida por todos los correos del proyecto — header con
 * marca, cuerpo, botón de acción opcional y footer, con la misma paleta
 * oscura que el dashboard (colores en hex porque los clientes de correo no
 * soportan var()/custom properties de CSS). Antes cada archivo (setup.php,
 * login.php, verify.php, forgot-password.php) armaba su propio HTML suelto;
 * centralizarlo aquí evita que cada correo se vea distinto y que un cambio
 * de estilo tenga que repetirse en cuatro lugares.
 *
 * $cta: ['label' => string, 'url' => string] o null si el correo no necesita botón.
 */
function render_email(string $title, string $bodyHtml, ?array $cta = null): string {
    $ctaHtml = '';
    if ($cta) {
        $ctaHtml = '
        <tr>
          <td align="center" style="padding: 8px 0 4px;">
            <a href="' . e($cta['url']) . '" target="_blank" rel="noopener"
              style="display:inline-block; padding:13px 28px; border-radius:8px; background:#1f6feb; color:#ffffff; font-weight:600; font-size:14px; text-decoration:none; font-family:Arial,Helvetica,sans-serif;">
              ' . e($cta['label']) . '
            </a>
          </td>
        </tr>';
    }

    $siteName = e(SITE_NAME);
    $year = date('Y');

    return '<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0; padding:0; background:#0d1117; font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background:#161b22; border:1px solid #30363d; border-radius:14px; overflow:hidden;">
          <tr>
            <td style="padding:20px 28px; background:#010409; border-bottom:1px solid #21262d;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="width:32px; height:32px; border-radius:8px; background:#1f6feb; color:#ffffff; font-weight:700; font-size:15px; text-align:center; vertical-align:middle; font-family:monospace;">M</td>
                <td style="padding-left:11px; color:#e6edf3; font-weight:600; font-size:14px;">' . $siteName . '</td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 28px 8px;">
              <h1 style="margin:0 0 16px; color:#e6edf3; font-size:19px; font-weight:700;">' . e($title) . '</h1>
              <div style="color:#c9d1d9; font-size:14.5px; line-height:1.65;">' . $bodyHtml . '</div>
            </td>
          </tr>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">' . $ctaHtml . '</table>
          <tr>
            <td style="padding:22px 28px 26px;">
              <hr style="border:none; border-top:1px solid #21262d; margin:0 0 16px;">
              <p style="margin:0; color:#6e7681; font-size:11.5px; line-height:1.6;">
                Correo automático de ' . $siteName . ' — no respondas a esta dirección.<br>
                © ' . $year . ' ' . $siteName . '.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>';
}

/* ---------- Correos concretos del proyecto ---------- */

function email_verification(string $to, string $verifyUrl): bool {
    $body = '<p>Gracias por crear tu cuenta de administrador. Antes de poder iniciar sesión, confirma que esta dirección de correo es tuya — así nos aseguramos de que los códigos de acceso y las alertas de seguridad realmente te lleguen.</p>
        <p>Este enlace vence en ' . EMAIL_VERIFY_TTL_MINUTES . ' minutos.</p>';
    $html = render_email('Confirma tu correo electrónico', $body, ['label' => 'Verificar mi correo', 'url' => $verifyUrl]);
    return send_email($to, 'Confirma tu correo — ' . SITE_NAME, $html);
}

function email_welcome(string $to, string $username): bool {
    $body = '<p>Tu cuenta de administrador del panel se creó y verificó correctamente.</p>
        <p><strong>Usuario:</strong> ' . e($username) . '<br>
        <strong>Fecha:</strong> ' . e(date('d/m/Y H:i')) . '</p>
        <p>Cada inicio de sesión te va a pedir un código de acceso enviado a este correo. Si tú no creaste esta cuenta, alguien más tiene acceso a este servidor — revísalo cuanto antes.</p>';
    $html = render_email('Cuenta creada', $body);
    return send_email($to, 'Cuenta creada — ' . SITE_NAME, $html);
}

function email_login_otp(string $to, string $code): bool {
    $body = '<p>Tu código de acceso es:</p>
        <p style="font-size:30px; font-weight:700; letter-spacing:0.12em; color:#e6edf3; margin:10px 0;">' . e($code) . '</p>
        <p>Vence en ' . LOGIN_OTP_TTL_MINUTES . ' minutos. Si no fuiste tú, ignora este correo.</p>';
    $html = render_email('Tu código de acceso', $body);
    return send_email($to, 'Tu código de acceso — ' . SITE_NAME, $html);
}

function email_password_reset_link(string $to, string $resetUrl): bool {
    $body = '<p>Pediste restablecer tu contraseña del panel de administración.</p>
        <p>Este enlace vence en ' . PASSWORD_RESET_TTL_MINUTES . ' minutos. Si no fuiste tú, ignora este correo — tu contraseña actual sigue funcionando.</p>';
    $html = render_email('Recuperar acceso', $body, ['label' => 'Restablecer contraseña', 'url' => $resetUrl]);
    return send_email($to, 'Recuperar acceso — ' . SITE_NAME, $html);
}

function email_password_reset_confirmed(string $to): bool {
    $body = '<p>Tu contraseña se restableció correctamente el ' . e(date('d/m/Y \a \l\a\s H:i')) . '.</p>
        <p>Por seguridad, cerramos todos los dispositivos recordados y sesiones pendientes. Si no fuiste tú quien hizo este cambio, contacta al responsable del sitio de inmediato.</p>';
    $html = render_email('Tu contraseña fue restablecida', $body);
    return send_email($to, 'Tu contraseña fue restablecida — ' . SITE_NAME, $html);
}

/**
 * $meta: ['ip' => string, 'userAgent' => string, 'remembered' => bool].
 * Formato inspirado en las alertas de acceso de Google: encabezado directo
 * ("¿Fuiste tú?"), dispositivo/navegador traducidos a texto legible (ver
 * parse_user_agent() en helpers.php) en vez del User-Agent crudo, y un botón
 * de acción claro — no solo una línea de texto al final — para restablecer
 * la contraseña si el acceso no fue reconocido.
 */
function email_new_login_notice(string $to, array $meta): bool {
    $ua = parse_user_agent($meta['userAgent'] ?? '');
    $deviceSummary = $ua['browser'] . ' en ' . $ua['os'] . ' · ' . $ua['device'];
    $rememberedText = $meta['remembered']
        ? 'Sí — no se te volverá a pedir un código de acceso en este dispositivo durante ' . TRUSTED_DEVICE_DAYS . ' días.'
        : 'No — la próxima vez que inicies sesión desde aquí se te pedirá un código de acceso.';
    // geolocate_ip() nunca lanza ni retrasa perceptiblemente esto (timeout de
    // 2-3s, ver su docblock en helpers.php) — si falla o la IP es privada
    // (ej. red local de XAMPP) simplemente se omite la línea de ubicación.
    $location = geolocate_ip($meta['ip'] ?? '');

    $body = '<p>Detectamos un nuevo inicio de sesión en tu panel de administración de ' . e(SITE_NAME) . '. Si fuiste tú, no necesitas hacer nada más.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0; background:#0d1117; border:1px solid #21262d; border-radius:10px;">
          <tr><td style="padding:14px 18px;">
            <p style="margin:0 0 8px; color:#e6edf3; font-weight:600; font-size:14px;">' . e($deviceSummary) . '</p>
            <p style="margin:0; color:#8b949e; font-size:13px; line-height:1.7;">
              Fecha: ' . e(date('d/m/Y \a \l\a\s H:i')) . '<br>' .
              ($location ? 'Ubicación aproximada: ' . e($location) . '<br>' : '') . '
              Dirección IP: ' . e($meta['ip'] ?? 'desconocida') . '<br>
              Dispositivo recordado: ' . e($rememberedText) . '
            </p>
          </td></tr>
        </table>
        <p style="color:#6e7681; font-size:12px;">La ubicación es aproximada (se calcula a partir de la IP, no de GPS) y puede no coincidir exactamente con tu ubicación real, sobre todo en redes móviles o VPN.</p>
        <p><strong>¿No fuiste tú?</strong> Alguien más podría tener tu contraseña — restablécela de inmediato con el botón de abajo. Eso cierra todas las sesiones y dispositivos recordados.</p>';
    $html = render_email('Nuevo inicio de sesión', $body, ['label' => 'Restablecer contraseña', 'url' => site_url('/admin/forgot-password.php')]);
    return send_email($to, 'Nuevo inicio de sesión — ' . SITE_NAME, $html);
}
