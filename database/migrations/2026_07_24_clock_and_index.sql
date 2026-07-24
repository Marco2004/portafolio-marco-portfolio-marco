-- Dos ajustes encontrados en una auditoría de seguridad/código (24 jul 2026),
-- ninguno cambia comportamiento observable, ambos endurecen cosas que el
-- código PHP ya hacía bien:
--
-- 1) rate_limit_hits.created_at: rate_limit_hit() (src/auth.php) siempre
--    escribe este valor explícito con el reloj de PHP, nunca dejando que la
--    columna use su propio DEFAULT — quitar el DEFAULT CURRENT_TIMESTAMP
--    convierte una posible re-aparición futura del bug de "reloj mezclado"
--    (PHP vs MySQL, ya documentado en CLAUDE.md) en un error ruidoso en vez
--    de un rate limit silenciosamente inefectivo. No requiere backfill: las
--    filas existentes ya tienen created_at escrito por PHP.
--
-- 2) auth_tokens: agrega el índice que le faltaba para las búsquedas de
--    find_password_reset()/find_email_verification() (WHERE purpose=...
--    AND consumed_at IS NULL AND expires_at > ...), que antes hacían table
--    scan completo.
--
-- Se ejecuta UNA VEZ sobre una base de datos ya existente (creada con
-- database/schema.sql antes de este cambio) — un proyecto nuevo puede
-- ignorar este archivo, ya que database/schema.sql ya incluye ambos cambios
-- desde el principio.

USE portafolio;

ALTER TABLE rate_limit_hits MODIFY created_at DATETIME NOT NULL;
ALTER TABLE auth_tokens ADD INDEX idx_purpose_consumed_expires (purpose, consumed_at, expires_at);
