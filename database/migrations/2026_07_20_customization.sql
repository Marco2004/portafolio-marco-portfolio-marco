-- Migración aditiva para la ronda de personalización (colores de LED de
-- disponibilidad, colores de nivel de habilidad, botones de proyecto
-- dinámicos). Se ejecuta UNA VEZ sobre una base de datos ya existente (creada
-- con database/schema.sql antes de este cambio) — un proyecto nuevo puede
-- ignorar este archivo por completo, ya que database/schema.sql ya incluye
-- estas columnas/tabla desde el principio.
--
-- No es destructiva: todas las columnas nuevas son NULL por defecto (el
-- LED sigue viendo verde y el nivel de habilidad sigue coloreándose por el
-- texto, exactamente igual que antes) y project_buttons se auto-rellena a
-- partir de demo_url/code_url la primera vez que Portfolio::getAll() lee un
-- proyecto sin botones — no hace falta migrar datos a mano aquí.

USE portafolio;

ALTER TABLE hero
  ADD COLUMN avail_color VARCHAR(20) NULL AFTER avail_en;

ALTER TABLE contact_info
  ADD COLUMN availability_badge_color VARCHAR(20) NULL AFTER availability_badge_en;

ALTER TABLE skills
  ADD COLUMN level_color VARCHAR(20) NULL AFTER level_en;

CREATE TABLE IF NOT EXISTS project_buttons (
  id INT PRIMARY KEY AUTO_INCREMENT,
  project_id INT NOT NULL,
  label VARCHAR(80) NOT NULL,
  label_en VARCHAR(80) NULL,
  url VARCHAR(255) NOT NULL,
  style ENUM('primary', 'secondary') NOT NULL DEFAULT 'secondary',
  sort_order INT NOT NULL DEFAULT 0,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB;
