-- Índices para las listas que Portfolio::getAll() ordena con
-- "ORDER BY sort_order ASC, id ASC" (ver src/Portfolio.php) — sin esto,
-- cada una de esas consultas hace un filesort completo de la tabla en vez
-- de leer las filas ya en orden. Con el volumen de datos actual (un
-- portafolio personal) esto no se nota, pero es la corrección correcta y no
-- cuesta nada mantenerla. Se ejecuta UNA VEZ sobre una base de datos ya
-- existente (creada con database/schema.sql antes de este cambio) — un
-- proyecto nuevo puede ignorar este archivo, ya que database/schema.sql ya
-- incluye estos índices desde el principio.
--
-- No se agregan índices a experience/education_entries/certifications:
-- esas tres ordenan por una expresión calculada (CASE .../IS NULL, ver
-- Portfolio::CURRENT_FIRST_ORDER_BY), que MySQL/MariaDB no puede resolver
-- con un índice normal — agregar uno ahí no lo usaría el optimizador y solo
-- sumaría costo de escritura sin ningún beneficio real.

USE portafolio;

ALTER TABLE hero_facts ADD INDEX idx_sort (sort_order, id);
ALTER TABLE projects ADD INDEX idx_sort (sort_order, id);
ALTER TABLE project_buttons ADD INDEX idx_sort (sort_order, id);
ALTER TABLE skill_categories ADD INDEX idx_sort (sort_order, id);
ALTER TABLE skills ADD INDEX idx_sort (sort_order, id);
ALTER TABLE skill_levels ADD INDEX idx_sort (sort_order, id);
ALTER TABLE contacts ADD INDEX idx_sort (sort_order, id);
ALTER TABLE social_links ADD INDEX idx_sort (sort_order, id);
