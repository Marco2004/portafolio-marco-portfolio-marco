-- Esquema de base de datos del Portafolio Web + Dashboard
-- Motor: MySQL / MariaDB (el que trae XAMPP). utf8mb4 para acentos y emojis.
--
-- Columnas "_en" (nullable): versión en inglés del mismo campo, capturada
-- manualmente desde el dashboard (sin traducción automática). Si están vacías,
-- el sitio público y el CV caen de regreso al valor en español. Los campos
-- sin gemelo "_en" no se traducen (nombres propios, URLs, tecnologías,
-- fechas, valores numéricos, datos de contacto).

/*CREATE DATABASE IF NOT EXISTS portafolio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE portafolio*/

-- Fila única (id=1) con los datos del hero. El tema/idioma del sitio público
-- ya no tienen un default configurable desde el dashboard (columnas
-- site_theme/site_lang eliminadas) — ahora siempre se resuelven en el
-- navegador de cada visitante (sistema operativo o su propia elección de
-- sesión), ver src/helpers.php::theme_antiflash_script() y public/assets/js.
-- La "Ficha rápida" (antes location/education_short/english_level fijos
-- aquí) ahora es la tabla libre hero_facts de abajo.
CREATE TABLE hero (
  id INT PRIMARY KEY,
  avail VARCHAR(255) NOT NULL,
  avail_en VARCHAR(255),
  name VARCHAR(120) NOT NULL,
  role VARCHAR(160) NOT NULL,
  role_en VARCHAR(160),
  description TEXT NOT NULL,
  description_en TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- "Ficha rápida" del hero — lista libre de dato+valor (ubicación, formación,
-- nivel de inglés, o cualquier otro que el admin quiera agregar, ej.
-- "Nacionalidad") en vez de las 3 columnas fijas que había antes. Mismo
-- patrón que la tabla contacts, pero con value_en porque aquí el valor sí es
-- traducible (ej. "Ingeniero en Sistemas" / "Systems Engineer").
CREATE TABLE hero_facts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  label VARCHAR(80) NOT NULL,
  label_en VARCHAR(80) NULL,
  value VARCHAR(200) NOT NULL,
  value_en VARCHAR(200) NULL,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE projects (
  id INT PRIMARY KEY AUTO_INCREMENT,
  is_flagship BOOLEAN NOT NULL DEFAULT FALSE,
  title VARCHAR(160) NOT NULL,
  tag VARCHAR(120),
  what_it_does TEXT,
  what_it_does_en TEXT,
  my_contribution TEXT,
  my_contribution_en TEXT,
  impact VARCHAR(255),
  impact_en VARCHAR(255),
  stack VARCHAR(255) COMMENT 'lista separada por comas, ej: PHP,MySQL,Responsive',
  demo_url VARCHAR(255),
  code_url VARCHAR(255),
  image_path VARCHAR(255) COMMENT 'ruta relativa dentro de uploads/projects/',
  -- Narrativa extendida, solo se muestra/edita cuando is_flagship = TRUE
  -- (tarjeta grande "Problema → Decisión técnica → Resultado" + 3 métricas).
  -- Ampliación sobre el schema.sql de referencia para soportar ese layout.
  problem TEXT,
  problem_en TEXT,
  decision_text TEXT,
  decision_text_en TEXT,
  result TEXT,
  result_en TEXT,
  stat1_value VARCHAR(40),
  stat1_label VARCHAR(120),
  stat1_label_en VARCHAR(120),
  stat2_value VARCHAR(40),
  stat2_label VARCHAR(120),
  stat2_label_en VARCHAR(120),
  stat3_value VARCHAR(40),
  stat3_label VARCHAR(120),
  stat3_label_en VARCHAR(120),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE skill_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  name_en VARCHAR(120),
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE skills (
  id INT PRIMARY KEY AUTO_INCREMENT,
  category_id INT NOT NULL,
  name VARCHAR(120) NOT NULL COMMENT 'nombre de la tecnología, no se traduce',
  level VARCHAR(60) NOT NULL COMMENT 'ej: Intermedio, Básico, Herramienta, Sistema',
  level_en VARCHAR(60),
  sort_order INT NOT NULL DEFAULT 0,
  FOREIGN KEY (category_id) REFERENCES skill_categories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE experience (
  id INT PRIMARY KEY AUTO_INCREMENT,
  role VARCHAR(160) NOT NULL,
  role_en VARCHAR(160),
  org VARCHAR(160),
  org_en VARCHAR(160),
  date_range VARCHAR(80) COMMENT 'se recalcula solo al guardar, a partir de start_date/end_date — ver format_date_range() en src/helpers.php',
  date_range_en VARCHAR(80),
  start_date DATE NULL COMMENT 'fecha real de inicio (capturada con el datepicker DD/MM/AA) — para ordenar de más reciente a más antigua y para generar date_range',
  end_date DATE NULL COMMENT 'NULL = "Presente" (puesto actual)',
  bullets TEXT COMMENT 'una responsabilidad por línea',
  bullets_en TEXT,
  metrics VARCHAR(255) COMMENT 'lista separada por comas',
  metrics_en VARCHAR(255),
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- Fila única (id=1) con la educación principal.
-- Fila única (id=1) — solo "Idiomas" ya vive aquí (lista aparte de qué
-- títulos/grados tenga el admin, ver education_entries abajo).
CREATE TABLE education (
  id INT PRIMARY KEY,
  languages TEXT COMMENT 'formato "Idioma — descripción" por línea',
  languages_en TEXT
) ENGINE=InnoDB;

-- Títulos/grados académicos — lista libre (antes una fila única en
-- education) para que el admin pueda agregar más de un título. Mismo
-- criterio de fechas que experience: date_range se recalcula solo al
-- guardar a partir de start_date/end_date.
CREATE TABLE education_entries (
  id INT PRIMARY KEY AUTO_INCREMENT,
  degree VARCHAR(160) NOT NULL,
  degree_en VARCHAR(160),
  org VARCHAR(160),
  org_en VARCHAR(160),
  date_range VARCHAR(80) COMMENT 'se recalcula solo al guardar, a partir de start_date/end_date — ver format_date_range() en src/helpers.php',
  date_range_en VARCHAR(80),
  start_date DATE NULL COMMENT 'fecha real de inicio (datepicker DD/MM/AA) — para generar date_range',
  end_date DATE NULL COMMENT 'NULL = "Presente" (en curso)',
  status VARCHAR(160),
  status_en VARCHAR(160),
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE certifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  name_en VARCHAR(200),
  issuer VARCHAR(160),
  issuer_en VARCHAR(160),
  issue_date DATE NULL COMMENT 'fecha real (datepicker DD/MM/AA) — para ordenar de más reciente a más antigua y para componer el texto mostrado en público/index.php vía format_es_date_long()',
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- Fila única (id=1) con el mensaje de disponibilidad. Los medios de
-- contacto en sí (antes columnas fijas email/phone aquí) viven en la tabla
-- "contacts" de abajo — cantidad variable por persona, ver punto 11.
CREATE TABLE contact_info (
  id INT PRIMARY KEY,
  availability_badge VARCHAR(255),
  availability_badge_en VARCHAR(255),
  -- URL del propio portafolio (se muestra en la barra de contacto del CV,
  -- ver src/Cv.php). No es traducible (es una URL) y se edita desde el
  -- dashboard (pestaña CV) en vez de quedar fija en el código: antes de tener
  -- un dominio definitivo, el admin deja aquí un valor de ejemplo y lo
  -- actualiza él mismo el día que despliegue.
  portfolio_url VARCHAR(255)
) ENGINE=InnoDB;

-- Medios de contacto (Email, Teléfono, o cualquier otro tipo que el admin
-- agregue) — lista libre tipo Certificaciones: Etiqueta + Valor + quitar.
-- Reemplaza las columnas fijas email/phone que antes vivían en contact_info.
CREATE TABLE contacts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  label VARCHAR(80) NOT NULL,
  label_en VARCHAR(80) NULL,
  value VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- Links de redes/plataformas externas del dashboard (Inicio > "Redes
-- sociales"): lista libre tipo chips, se agrega/quita desde el admin sin
-- tocar código — la plataforma/ícono se detecta por dominio o esquema al
-- mostrarse (ver detect_social_platform() en src/helpers.php), no se
-- guarda aquí.
CREATE TABLE social_links (
  id INT PRIMARY KEY AUTO_INCREMENT,
  url VARCHAR(500) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Único usuario administrador del dashboard.
CREATE TABLE admin_users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(60) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL COMMENT 'generado con password_hash() de PHP',
  email VARCHAR(160) UNIQUE NOT NULL COMMENT 'a donde llegan el código de login y los links de recuperación',
  email_verified_at DATETIME NULL COMMENT 'NULL hasta que confirme el correo tras setup.php; login.php bloquea el acceso mientras tanto',
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Códigos de un solo uso: verificación de login (OTP), recuperación de
-- contraseña y verificación de correo comparten esta tabla, diferenciados
-- por "purpose".
CREATE TABLE auth_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  admin_id INT NOT NULL,
  purpose ENUM('login_otp', 'password_reset', 'email_verify') NOT NULL,
  token_hash VARCHAR(255) NOT NULL COMMENT 'hash del código/token, nunca se guarda en claro',
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Límite de intentos por IP (independiente del cooldown por sesión que ya
-- tienen algunos formularios): cada intento sensible (ej. forgot-password)
-- inserta una fila aquí; rate_limit_hit() en src/auth.php cuenta cuántas hay
-- en la ventana de tiempo. A diferencia de un límite por sesión, este no se
-- evade limpiando cookies o abriendo una ventana de incógnito.
CREATE TABLE rate_limit_hits (
  id INT PRIMARY KEY AUTO_INCREMENT,
  bucket VARCHAR(60) NOT NULL,
  ip VARCHAR(45) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bucket_ip_time (bucket, ip, created_at)
) ENGINE=InnoDB;

-- "Recordar este dispositivo" (30 días) con patrón selector/validador:
-- selector localiza la fila rápido, validator_hash se compara con hash_equals()
-- para evitar ataques de tiempo. Revocable sin exponer el valor real de la cookie.
CREATE TABLE trusted_devices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  admin_id INT NOT NULL,
  selector VARCHAR(24) NOT NULL UNIQUE,
  validator_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
