-- Contenido inicial de Marco Polo Vilchis, alineado con su CV actualizado
-- (Marco_Polo_Vilchis_CV_Actualizado_Final.pdf), con traducción al inglés
-- capturada manualmente para cada campo traducible. Todo esto es editable
-- desde el dashboard (incluida la versión en inglés, con el toggle
-- "Editando: Español / English" del topbar) — este archivo solo siembra la
-- base de datos la primera vez.

--USE portafolio;

INSERT INTO hero (id, avail, avail_en, name, role, role_en, description, description_en) VALUES
(1,
 'DISPONIBLE PARA TRABAJAR · TOLUCA, MÉXICO · PRESENCIAL O REMOTO',
 'AVAILABLE FOR WORK · TOLUCA, MEXICO · ON-SITE OR REMOTE',
 'Marco Polo Vilchis',
 'Ingeniero en Sistemas Computacionales · Desarrollador de Software Junior',
 'Computer Systems Engineer · Junior Software Developer',
 'Ingeniero en Sistemas Computacionales orientado al desarrollo de software, con experiencia práctica en aplicaciones web, bases de datos relacionales y soporte técnico. He desarrollado soluciones con PHP, MySQL, JavaScript, HTML y CSS, incluyendo un portal de noticias con operaciones CRUD y una aplicación de control de asistencia mediante códigos QR. Busco contribuir en el desarrollo, mantenimiento y mejora de soluciones tecnológicas como Desarrollador de Software Junior.',
 'Computer Systems Engineer focused on software development, with hands-on experience in web applications, relational databases, and technical support. I have built solutions with PHP, MySQL, JavaScript, HTML, and CSS, including a news portal with CRUD operations and a QR-code attendance tracking application. Looking to contribute to the development, maintenance, and improvement of technology solutions as a Junior Software Developer.'
);

-- "Ficha rápida" inicial (antes columnas fijas de hero) — el admin puede
-- agregar/quitar/editar libremente desde el dashboard.
INSERT INTO hero_facts (label, label_en, value, value_en, sort_order) VALUES
('Ubicación', 'Location', 'Toluca de Lerdo, Estado de México', 'Toluca de Lerdo, State of Mexico', 0),
('Formación', 'Education', 'Ing. en Sistemas · Titulado', 'B.Eng. in Computer Systems · Graduate', 1),
('Inglés', 'English', 'Básico (profesional)', 'Basic (professional working proficiency)', 2);

INSERT INTO projects (is_flagship, title, tag, what_it_does, what_it_does_en, my_contribution, my_contribution_en, impact, impact_en, stack, demo_url, code_url, image_path, problem, problem_en, decision_text, decision_text_en, result, result_en, stat1_value, stat1_label, stat1_label_en, stat2_value, stat2_label, stat2_label_en, stat3_value, stat3_label, stat3_label_en, sort_order) VALUES
(TRUE,
 'Portal de Noticias',
 'Freelance · 2024',
 'Permite publicar, editar y administrar noticias desde un panel, en un sitio en internet real (bernardojasso.com).',
 'Lets you publish, edit, and manage news from an admin panel, on a real, live website (bernardojasso.com).',
 'Lo desarrollé completo (front y back), con base de datos, diseño adaptable a celular y publicación en hosting.',
 'I built it end-to-end (front and back), with a database, mobile-friendly design, and hosting deployment.',
 '+50 notas gestionadas · panel de administración · carga optimizada en móvil',
 '50+ articles managed · admin panel · mobile-optimized loading',
 'PHP,MySQL,Responsive',
 'https://portal-noticias-demo.vercel.app',
 'https://github.com',
 NULL,
 'El cliente publicaba noticias manualmente en un blog genérico, sin control de usuarios ni panel propio.',
 'The client was publishing news manually on a generic blog, with no user control or dedicated admin panel.',
 'Elegí PHP + MySQL con arquitectura CRUD propia para dar control total del panel, sin depender de un CMS de terceros.',
 'I chose PHP + MySQL with a custom CRUD architecture to give full control over the panel, without depending on a third-party CMS.',
 'Sitio en producción con panel propio, publicación autónoma y diseño adaptable a cualquier dispositivo.',
 'Site in production with its own admin panel, independent publishing, and a design that adapts to any device.',
 '+50', 'notas publicadas y gestionadas', 'articles published and managed',
 '100%', 'adaptable a celular y escritorio', 'responsive on mobile and desktop',
 '6 sem', 'de idea a sitio en producción', 'from idea to production',
 0
),
(FALSE,
 'Control de Asistencia con QR',
 'ISEU · 2024',
 'Registra la asistencia escaneando un código QR, sin pasar lista manualmente.',
 'Records attendance by scanning a QR code, with no manual roll call.',
 'Desarrollé la interfaz con Bootstrap y el backend con PHP durante mi servicio social en ISEU.',
 'I built the interface with Bootstrap and the backend with PHP during my social service at ISEU.',
 'Registro en <2s por persona · elimina el pase de lista manual · reportes automáticos',
 'Check-in under 2s per person · removes manual roll call · automatic reports',
 'PHP,MySQL,Bootstrap,Códigos QR',
 'https://asistencia-qr-demo.vercel.app',
 'https://github.com',
 NULL,
 NULL, NULL, NULL, NULL, NULL, NULL,
 NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
 1
),
(FALSE,
 'Sistema de Inventario',
 'Proyecto personal',
 'Administra productos, controla existencias y avisa cuando el stock está bajo.',
 'Manages products, tracks stock, and alerts when inventory runs low.',
 'Lo construí por iniciativa propia, full-stack, para reforzar mis habilidades con PHP y MySQL.',
 'I built it on my own initiative, full-stack, to strengthen my PHP and MySQL skills.',
 'CRUD de productos · alertas de bajo stock · reportes en tiempo real',
 'Product CRUD · low-stock alerts · real-time reports',
 'PHP,MySQL,JavaScript',
 'https://inventario-demo.vercel.app',
 'https://github.com',
 NULL,
 NULL, NULL, NULL, NULL, NULL, NULL,
 NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
 2
);

INSERT INTO skill_categories (id, name, name_en, sort_order) VALUES
(1, 'Lenguajes', 'Languages', 0),
(2, 'Bases de Datos', 'Databases', 1),
(3, 'Herramientas', 'Tools', 2),
(4, 'Sistemas & Soporte TI', 'Systems & IT Support', 3);

INSERT INTO skills (category_id, name, level, level_en, sort_order) VALUES
(1, 'PHP', 'Intermedio', 'Intermediate', 0),
(1, 'HTML5 & CSS3', 'Intermedio', 'Intermediate', 1),
(1, 'JavaScript', 'Básico', 'Basic', 2),
(2, 'MySQL', 'Intermedio', 'Intermediate', 0),
(2, 'SQL', 'Intermedio', 'Intermediate', 1),
(2, 'phpMyAdmin', 'Herramienta', 'Tool', 2),
(3, 'Bootstrap', 'Framework', 'Framework', 0),
(3, 'Git & GitHub', 'Versiones', 'Version control', 1),
(3, 'VS Code', 'Editor', 'Editor', 2),
(3, 'XAMPP', 'Entorno local', 'Local environment', 3),
(4, 'Windows / Server', 'Sistema', 'System', 0),
(4, 'Linux', 'Sistema', 'System', 1),
(4, 'Redes', 'Configuración', 'Configuration', 2),
(4, 'Soporte a usuarios', 'Soporte', 'Support', 3);

-- date_range/date_range_en se recalculan solos a partir de start_date/end_date
-- la próxima vez que se guarde desde el Dashboard (ver Portfolio::saveAll()) —
-- aquí se insertan ya coherentes con esas fechas para que un sitio recién
-- instalado se vea bien desde el primer momento, sin tener que abrir y
-- volver a guardar el Dashboard.
INSERT INTO experience (role, role_en, org, org_en, date_range, date_range_en, start_date, end_date, bullets, bullets_en, metrics, metrics_en, sort_order) VALUES
('Desarrollador Web Freelance',
 'Freelance Web Developer',
 'Profesional independiente · Toluca, México · Remoto',
 'Independent professional · Toluca, Mexico · Remote',
 'Noviembre de 2024 — Diciembre de 2024',
 'November 2024 — December 2024',
 '2024-11-01',
 '2024-12-01',
 'Diseñé y desarrollé bernardojasso.com, un portal de noticias orientado a la publicación y administración de contenido.\nImplementé funcionalidades CRUD para la gestión de artículos mediante PHP y MySQL, desarrollando front-end y back-end con HTML, CSS, JavaScript y PHP.\nAdapté la interfaz para dispositivos móviles y de escritorio, configuré el alojamiento web y desplegué el sitio en un entorno productivo.',
 'Designed and developed bernardojasso.com, a news portal focused on content publishing and management.\nImplemented CRUD functionality for article management using PHP and MySQL, building the front-end and back-end with HTML, CSS, JavaScript, and PHP.\nAdapted the interface for mobile and desktop devices, configured web hosting, and deployed the site to a production environment.',
 'Entrega en 6 semanas,100% responsive,0 incidencias post-lanzamiento',
 'Delivered in 6 weeks,100% responsive,0 post-launch incidents',
 0
),
('Desarrollo Web y Soporte Técnico — Servicio Social',
 'Web Development and Technical Support — Social Service',
 'ISEU Sistemas y Posgrados · Toluca, México · Presencial',
 'ISEU Sistemas y Posgrados · Toluca, Mexico · On-site',
 'Mayo de 2024 — Noviembre de 2024',
 'May 2024 — November 2024',
 '2024-05-01',
 '2024-11-01',
 'Participé en el desarrollo de una aplicación web para el registro y control de asistencia de estudiantes en servicio social y prácticas profesionales.\nDesarrollé la interfaz con Bootstrap y funcionalidades de servidor con PHP; integré lectura de códigos QR y administré la base de datos en MySQL.\nRealicé consultas, validaciones y actualizaciones de información, además de brindar soporte técnico y mantenimiento preventivo y correctivo a equipos de cómputo.',
 'Took part in developing a web application for registering and tracking attendance of students in social service and professional internships.\nBuilt the interface with Bootstrap and server-side functionality with PHP; integrated QR code scanning and managed the MySQL database.\nPerformed queries, validations, and data updates, in addition to providing technical support and preventive/corrective maintenance to computer equipment.',
 'Registro en <2s por persona,30+ equipos con mantenimiento,Soporte resuelto el mismo día',
 'Check-in under 2s per person,30+ machines maintained,Support resolved same day',
 1
);

INSERT INTO education (id, languages, languages_en) VALUES
(1,
 'Español — nativo\nInglés — competencia básica profesional; lectura de documentación técnica y redacción de correos técnicos',
 'Spanish — native\nEnglish — basic professional working proficiency; reading technical documentation and writing technical emails'
);

INSERT INTO education_entries (degree, degree_en, org, org_en, date_range, date_range_en, start_date, end_date, status, status_en, sort_order) VALUES
('Ingeniería en Sistemas Computacionales',
 'B.Eng. in Computer Systems Engineering',
 'ISEU Sistemas y Posgrados · Toluca de Lerdo, Estado de México',
 'ISEU Sistemas y Posgrados · Toluca de Lerdo, State of Mexico',
 'Septiembre de 2022 — Agosto de 2025',
 'September 2022 — August 2025',
 '2022-09-01',
 '2025-08-01',
 'Egresado y titulado · título profesional en proceso de expedición',
 'Graduate · professional degree in process of issuance',
 0
);

-- issuer/issuer_en son solo el nombre de la institución — la fecha ya no se
-- escribe a mano ahí, se compone al mostrarse a partir de issue_date (ver
-- format_es_date_long() en src/helpers.php, usado en public/index.php).
INSERT INTO certifications (name, name_en, issuer, issuer_en, issue_date, sort_order) VALUES
('Artificial Intelligence Fundamentals', 'Artificial Intelligence Fundamentals', 'IBM SkillsBuild', 'IBM SkillsBuild', '2024-12-01', 0),
('AI Fundamentals with IBM SkillsBuild', 'AI Fundamentals with IBM SkillsBuild', 'Cisco Networking Academy', 'Cisco Networking Academy', '2024-12-01', 1),
('Networking Academy Learn-A-Thon 2024', 'Networking Academy Learn-A-Thon 2024', 'Cisco', 'Cisco', '2025-01-01', 2),
('Introduction to IoT', 'Introduction to IoT', 'Cisco Networking Academy', 'Cisco Networking Academy', '2023-08-01', 3),
('Networking Essentials', 'Networking Essentials', 'Cisco Networking Academy', 'Cisco Networking Academy', '2023-06-01', 4),
('Los bits y bytes de las redes informáticas', 'The Bits and Bytes of Computer Networking', 'Coursera / Google', 'Coursera / Google', '2022-04-01', 5),
('Aspectos básicos de la asistencia técnica', 'Technical Support Fundamentals', 'Coursera / Google', 'Coursera / Google', '2022-03-01', 6);

INSERT INTO contact_info (id, availability_badge, availability_badge_en, portfolio_url) VALUES
(1,
 'Disponible para trabajar — incorporación inmediata · Presencial (Toluca) o remoto',
 'Available for work — immediate start · On-site (Toluca) or remote',
 'https://tu-portafolio-aqui.com'
);

-- Medios de contacto (dashboard > Contacto): lista libre, agrega o quita los
-- que quieras desde ahí sin tocar código.
INSERT INTO contacts (label, label_en, value, sort_order) VALUES
('Email', 'Email', 'marco.polo.jr1@gmail.com', 0),
('Teléfono', 'Phone', '722 448 2737', 1);

-- Links de redes/plataformas (dashboard > Inicio > "Redes sociales"): lista
-- libre, agrega o quita las que quieras desde ahí sin tocar código.
INSERT INTO social_links (url, sort_order) VALUES
('https://www.linkedin.com/in/marco-polo-vilchis-9155a1234', 0),
('https://github.com', 1);

-- El usuario admin NO se crea aquí por seguridad.
-- Ejecuta admin/setup.php una sola vez desde el navegador para crear tu usuario y contraseña reales.
-- El GitHub sigue como placeholder (https://github.com) a propósito — reemplázalo
-- desde el dashboard (sección Inicio > Redes sociales) cuando tengas tu URL real.
