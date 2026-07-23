-- Los 5 niveles de habilidad (Básico/Intermedio/Avanzado/Herramienta/Sistema)
-- dejan de ser una lista fija por código: se vuelven datos que el admin
-- puede gestionar igual que cualquier otra lista del dashboard — agregar,
-- eliminar, recolorear. Esta tabla es la fuente de verdad de esa lista;
-- se siembra una vez con los 5 valores de siempre (mismos colores que ya
-- tenían) para que ningún dato existente cambie de aspecto al aplicar esto.
--
-- IMPORTANTE al ejecutar este archivo a mano por CLI: usar
-- `mysql --default-character-set=utf8mb4 < este_archivo.sql` — sin ese flag,
-- el cliente de mysql en Windows puede interpretar los acentos (Básico) con
-- el charset equivocado y guardarlos corruptos de forma permanente.
--
-- No destructiva: level_color en `skills` no se toca — si una habilidad ya
-- tenía un color propio guardado, lo sigue teniendo igual que antes.

USE portafolio;

-- label/label_en son AMBAS nullable a propósito: una definición agregada
-- por el admin vive en UN solo idioma a la vez (sin traducción automática,
-- ver skillLevelField() en admin-forms.js) — solo los 5 presets sembrados
-- abajo traen los dos de una vez.
CREATE TABLE IF NOT EXISTS skill_levels (
  id INT PRIMARY KEY AUTO_INCREMENT,
  label VARCHAR(60) NULL,
  label_en VARCHAR(60) NULL,
  color VARCHAR(20) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

INSERT INTO skill_levels (label, label_en, color, sort_order) VALUES
  ('Básico', 'Basic', '#d29922', 0),
  ('Intermedio', 'Intermediate', '#58a6ff', 1),
  ('Avanzado', 'Advanced', '#3fb950', 2),
  ('Herramienta', 'Tool', '#a371f7', 3),
  ('Sistema', 'System', '#39c5cf', 4);
