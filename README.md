# Portafolio Web · Portfolio Website — Marco Polo Vilchis

<p align="left">
  <img alt="PHP" src="https://img.shields.io/badge/PHP-8-777BB4?logo=php&logoColor=white">
  <img alt="MySQL" src="https://img.shields.io/badge/MySQL%2FMariaDB-4479A1?logo=mysql&logoColor=white">
  <img alt="No build step" src="https://img.shields.io/badge/build%20step-none-7ee787">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-green">
</p>

Portafolio profesional con un dashboard de administración privado: todo el contenido del sitio público (hero, proyectos, habilidades, experiencia, educación, certificaciones, contacto, redes sociales, CV) se edita desde el dashboard y se refleja de inmediato en el sitio público y en el CV descargable — sin texto duplicado ni hardcodeado.

Professional portfolio site with a private admin dashboard: all public-site content (hero, projects, skills, experience, education, certifications, contact, social links, résumé) is edited from the dashboard and reflects instantly on the public site and the downloadable résumé — no duplicated or hardcoded text.

**🇪🇸 [Español](#español-1)** · **🇬🇧 [English](#english-1)**

> **Nota de portafolio / Portfolio note:** este repositorio es la versión pública de mi propio sitio personal. El contenido (nombre, proyectos, experiencia, contacto) es real; lo único que no se sube es configuración local sensible (`.env` con credenciales de base de datos/correo) — ver [Seguridad](#seguridad). // This repository is the public version of my own personal site. The content (name, projects, experience, contact info) is real; the only thing excluded is sensitive local configuration (`.env` with database/mail credentials) — see [Security](#implemented-security-1).

---

## Tabla de contenido / Table of contents

- [Español](#español-1)
  - [Descripción](#descripción)
  - [Stack](#stack)
  - [Funcionalidades](#funcionalidades)
  - [Estructura del proyecto](#estructura-del-proyecto)
  - [Instalación (XAMPP)](#instalación-xampp)
  - [Variables de entorno](#variables-de-entorno)
  - [Uso del dashboard](#uso-del-dashboard)
  - [Seguridad](#seguridad)
  - [Capturas de pantalla](#capturas-de-pantalla)
  - [Verificación y pruebas](#verificación-y-pruebas)
  - [Limitaciones conocidas](#limitaciones-conocidas)
- [English](#english-1)
  - [Description](#description)
  - [Tech stack](#tech-stack)
  - [Features](#features)
  - [Project structure](#project-structure)
  - [Installation (XAMPP)](#installation-xampp)
  - [Environment variables](#environment-variables)
  - [Using the dashboard](#using-the-dashboard)
  - [Implemented security](#implemented-security-1)
  - [Screenshots](#screenshots-1)
  - [Verification and testing](#verification-and-testing)
  - [Known limitations](#known-limitations)
- [Licencia / License](#licencia--license)

---

## Español

### Descripción

Sitio de portafolio de un solo administrador (no multiusuario, por diseño), pensado para que una sola persona mantenga su propio contenido profesional sin depender de un CMS de terceros. El backend es PHP 8 puro con PDO, sin framework, sin Composer y sin paso de build: los archivos se sirven tal cual desde Apache.

**[Ver capturas de pantalla](#capturas-de-pantalla)** · **[Instalación](#instalación-xampp)** · **[Seguridad](#seguridad)**

### Stack

| Capa | Tecnología |
|---|---|
| Backend | PHP 8 puro + PDO (sin framework, sin Composer, sin build step) |
| Base de datos | MySQL / MariaDB |
| Frontend | HTML + CSS y JavaScript vanilla, organizados por archivo |
| Correo | [Brevo](https://www.brevo.com) (API HTTP transaccional, plan gratuito) vía cURL nativo de PHP |
| Config | Variables de entorno (`.env`), sin secretos en el código versionado |

No hay paso de build ni bundler: los archivos se sirven tal cual desde
Apache, exactamente como están en el repositorio.

El correo se manda por API HTTP (Brevo) en vez de SMTP a propósito: muchos
hosts gratuitos (Google Cloud incluido) bloquean los puertos SMTP salientes,
pero nunca el puerto 443/HTTPS que usa esta API — así el envío de correo
funciona igual en local que en un hosting gratuito real.

### Funcionalidades

#### Sitio público (`public/`)
- Hero, proyectos (con tarjeta "insignia" ampliada), habilidades, experiencia,
  educación, certificaciones, contacto y overlay de CV — todo renderizado
  server-side desde la base de datos.
- **Selector ES/EN** con detección automática por navegador en la primera
  visita, y un fundido (fade) suave al cambiar de idioma con el botón —
  respeta `prefers-reduced-motion`. No se anima al cargar la página, solo al
  hacer clic.
- **Tema claro/oscuro** persistente, con detección de `prefers-color-scheme`
  en la primera visita y una transición tipo fade al alternarlo (sin
  parpadeo al cargar la página).
- **Links de redes sociales dinámicos**: se agregan/quitan desde el
  dashboard (no hay un límite fijo de plataformas); el ícono y la etiqueta de
  cada uno se detectan automáticamente por dominio (LinkedIn, GitHub, X,
  Instagram, Facebook, YouTube, WhatsApp, Telegram, TikTok, Dribbble, o un
  ícono genérico de enlace para cualquier otro dominio).
- **Experiencia y certificaciones siempre en orden cronológico** (más
  reciente primero), calculado automáticamente a partir de una fecha real
  capturada en el dashboard — no depende del orden en que se guardaron.
- **CV auto-generado** (`src/Cv.php`): mismo formato que un CV real, 100%
  generado a partir de los datos del dashboard, descargable en PDF.

#### Dashboard (`admin/`)
- Edición de todo el contenido vía formularios que guardan por AJAX
  (`api/save.php`), protegidos con CSRF.
- Vista previa en vivo del sitio público (redimensionable, colapsable y
  ampliable a pantalla completa); al ocultarla, el formulario aprovecha el
  espacio liberado en vez de dejarlo vacío. La vista previa oculta el
  header/nav del sitio (no aporta nada dentro del panel).
- Barra lateral colapsable a solo-iconos.
- Arrastrar para reordenar proyectos y categorías de habilidades. Experiencia
  y certificaciones **no** se arrastran — su orden es automático por fecha
  (ver arriba).
- Entrada de "chips" para tecnologías, métricas y redes sociales: escribe y
  presiona Enter (o pega una lista/URL), con detección de duplicados.
- **Confirmación de eliminación** con un modal propio animado (no el
  `window.confirm()` nativo del navegador) antes de borrar cualquier
  proyecto, habilidad, experiencia o certificación.
- Avisos de "guardando…"/éxito/error como toasts, consistentes con el resto
  de la interfaz — nunca `alert()`.

#### Bilingüe manual
Cada campo narrativo tiene su columna `_en` en la base de datos; el
dashboard tiene un selector "Editando: Español/English" para capturar ambas
versiones. El botón ES/EN del sitio solo muestra la que corresponda — no hay
traducción automática por IA ni por API externa.

### Estructura del proyecto

```text
portafolio-marco/
├── public/          → sitio público (index.php + assets/css, assets/js, uploads)
├── admin/           → dashboard privado (login, verify, verify-email, setup,
│                      index, forgot/reset-password) + assets/css, assets/js
├── api/             → endpoints JSON que usa el dashboard (portfolio.php, save.php, upload-*.php)
├── src/             → lógica: auth.php, Mailer.php, Portfolio.php, Cv.php, db.php,
│                      helpers.php, config.php, logs/ (bitácora de seguridad,
│                      no servible por HTTP)
├── database/        → schema.sql (estructura) + seed.sql (contenido de ejemplo)
├── i18n/            → es.json / en.json (textos fijos de la interfaz pública)
├── screenshots/     → capturas usadas en este README
├── .env.example     → plantilla de variables de entorno (copiar a .env)
└── .htaccess        → sirve public/ en la raíz del dominio + cabeceras de
                       seguridad + bloqueo de dotfiles
```

### Instalación (XAMPP)

**Requisitos:** PHP 8.0+, MySQL/MariaDB, Apache con `mod_rewrite`/`mod_headers`
(cualquier instalación estándar de XAMPP los trae).

1. Copia el proyecto a `htdocs/` (ej. `C:\xampp\htdocs\portafolio-marco`).
2. Crea la base de datos e impórtala:
   ```bash
   mysql -u root -e "CREATE DATABASE portafolio"
   mysql -u root portafolio < database/schema.sql
   mysql -u root portafolio < database/seed.sql   # opcional, contenido de ejemplo
   ```
3. Copia `.env.example` a `.env` y rellena tus propios valores (ver
   [Variables de entorno](#variables-de-entorno) abajo). `.env` nunca se sube
   a git y el `.htaccess` de la raíz bloquea su descarga por HTTP.
4. Abre `http://localhost/portafolio-marco/admin/setup.php` para crear la
   única cuenta de administrador (el formulario desaparece en cuanto existe
   una cuenta). Vas a necesitar confirmar tu correo antes de poder iniciar
   sesión — revisa tu bandeja de entrada.
5. Sitio público: `http://localhost/portafolio-marco/public/index.php`.
   Dashboard: `http://localhost/portafolio-marco/admin/login.php`.

No hay paso de build ni comandos de compilación — los archivos se sirven tal
cual desde Apache.

En producción (dominio real, `mod_rewrite` activo), el `.htaccess` de la raíz
sirve el sitio público directamente en `https://midominio.com/` — no hace
falta escribir `/public` en la URL (`https://midominio.com/public/index.php`
sigue funcionando igual, es la misma página). En XAMPP local, dentro de una
subcarpeta de `htdocs`, seguí usando la ruta con `/public/` como en el paso 5
(la reescritura asume que el proyecto vive en la raíz del document root).

### Variables de entorno

Definidas en `.env` (ver `.env.example`), leídas por `src/config.php`:

| Variable | Descripción | Default si falta |
|---|---|---|
| `DB_HOST` | Host de MySQL | `127.0.0.1` |
| `DB_NAME` | Nombre de la base de datos | `portafolio` |
| `DB_USER` | Usuario de MySQL | `root` |
| `DB_PASS` | Contraseña de MySQL | *(vacío)* |
| `BREVO_API_KEY` | API key de [Brevo](https://www.brevo.com) (plan gratuito: 300 correos/día, sin tarjeta) — Panel > SMTP & API > API Keys | *(sin default, requerido para enviar correo)* |
| `MAIL_FROM_EMAIL` | Correo remitente — debe ser el que verificaste en Brevo como "remitente individual" | *(sin default, requerido para enviar correo)* |
| `MAIL_FROM_NAME` | Nombre visible del remitente | igual que `SITE_NAME` |
| `SITE_NAME` | Nombre del sitio, usado en correos y `<title>` | `Portafolio Web` |
| `SITE_URL` | Dominio público real (sin `/` final, ej. `https://midominio.com`), usado para armar los links de recuperación de contraseña/verificación de correo | *(vacío → usa el Host de la petición, solo pensado para desarrollo local)* |
| `ADMIN_ACCESS_KEY` | Clave secreta para poder abrir `/admin` (ver [Seguridad](#seguridad)) — genera la tuya con `php -r "echo bin2hex(random_bytes(20));"` | *(vacío → `/admin` no está protegido por clave, solo pensado para desarrollo local)* |

Sin `BREVO_API_KEY`/`MAIL_FROM_EMAIL` configurados, el sitio funciona con
normalidad pero ningún correo (verificación de cuenta, códigos de acceso,
recuperación de contraseña) podrá enviarse — necesarios para poder iniciar
sesión. El correo se manda vía la API HTTP de Brevo en vez de SMTP para que
funcione igual en hosts gratuitos que bloquean puertos SMTP salientes (ver
[Stack](#stack)). El plan gratuito de Brevo agrega un pequeño pie de página
"Sent with Brevo" a cada correo — informativo, no es un error.

### Uso del dashboard

0. **En producción**: si configuraste `ADMIN_ACCESS_KEY` (ver
   [Variables de entorno](#variables-de-entorno)), la primera vez tenés que
   abrir `https://midominio.com/admin/login.php?key=TU_CLAVE`. Desde ahí una
   cookie de un año recuerda el navegador — no hace falta repetir la clave en
   cada visita, y cualquiera que entre a `/admin` sin ella recibe un 404 liso,
   como si el panel no existiera.
1. **Primer arranque**: `admin/setup.php` crea la única cuenta — el
   formulario incluye un medidor de fortaleza de contraseña propio (niveles
   de "Muy débil" a "Muy fuerte", con la política real aplicada también en
   el servidor).
2. **Verificación de correo**: tras crear la cuenta, se envía un enlace de
   confirmación — el login queda bloqueado hasta confirmarlo.
3. **Login en dos pasos**: usuario o correo + contraseña, luego un código de
   6 dígitos enviado por correo (con opción de "recordar este dispositivo"
   por 30 días). Cada inicio de sesión exitoso también notifica por correo.
4. **Editar contenido**: cada pestaña de la barra lateral corresponde a una
   sección del sitio público. Los cambios se guardan hasta presionar
   "Guardar cambios" — antes de eso solo viven en el navegador (con un
   borrador automático en `localStorage` por si se recarga la página sin
   querer).
5. **Vista previa en vivo**: el panel de la derecha es el sitio real
   cargado en un iframe, sincronizado en cada cambio sin necesidad de
   guardar primero.

### Seguridad

- **Sin secretos en el código versionado**: credenciales de BD y la API key
  de Brevo viven en `.env` (ignorado por git), nunca en `src/config.php`.
- **`/admin` oculto tras una clave secreta** (`ADMIN_ACCESS_KEY` en `.env`,
  ver [Uso del dashboard](#uso-del-dashboard)): sin ella, cualquier URL bajo
  `/admin/` responde 404 como si no existiera — pensado contra bots/escáneres
  que prueban `/admin/login.php` a ciegas, no reemplaza el login real
  (contraseña + 2FA) sino que se suma encima. Los links de verificación de
  correo/recuperación de contraseña no pasan por esta clave: su propio token
  de un solo uso ya cumple ese papel.
- **`.htaccess` bloquea el acceso HTTP directo** a cualquier dotfile
  (`.env`, `.gitignore`, etc.), a `database/*.sql`, a `src/*.php` y al log de
  seguridad — solo Apache/PHP internamente pueden leerlos.
- **Contraseñas**: mínimo 8 caracteres, rechaza contraseñas de una lista
  negra de las más filtradas/reutilizadas, coincidencias con el usuario/correo,
  y patrones triviales (repetidos, secuenciales) — validado en cliente y
  servidor por igual (criterio alineado con NIST 800-63B: longitud y lista
  negra pesan más que exigir combinaciones arbitrarias de símbolos).
- **Verificación de correo obligatoria** antes del primer login (evita
  cuentas creadas con un correo inexistente/ajeno).
- **Login en dos pasos** (contraseña + código de un solo uso por correo),
  bloqueo temporal tras varios intentos fallidos, "recordar dispositivo"
  revocado automáticamente al restablecer la contraseña o cerrar sesión.
- **Recuperación de contraseña**: mensajes explícitos ("ese usuario no
  existe" / "ese correo no está asociado a ninguna cuenta") en vez del
  mensaje ambiguo típico anti-enumeración — decisión consciente para este
  proyecto de un solo administrador, donde esa protección no aporta nada
  (solo existe una cuenta posible) y a cambio dificultaba diagnosticar
  typos; el límite de solicitudes tanto por sesión (cooldown de 60s entre
  envíos) como por IP (5 cada 15 min) sigue aplicando para que no se use
  para sondear identificadores o espamear correos sin freno.
- **CSRF**: token por header en las llamadas AJAX del dashboard, y token de
  campo oculto en los formularios clásicos de autenticación (login, setup,
  forgot-password, reset, verify).
- **Sesiones**: cookies `HttpOnly` + `SameSite=Lax`, regeneración de ID tras
  login, cierre automático por inactividad.
- **Correos con diseño propio y consistente** (verificación, bienvenida,
  código de acceso, recuperación y confirmación de contraseña, aviso de
  nuevo inicio de sesión) — nunca texto plano genérico.
- **Cabeceras HTTP** (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`) vía
  `.htaccess`.
- **Bitácora de seguridad** en `src/logs/security.log` (intentos fallidos,
  bloqueos, altas de cuenta, resets) — nunca registra contraseñas, códigos ni
  tokens en claro.

### Capturas de pantalla

| Login | Dashboard — Inicio + vista previa | Dashboard — Proyectos |
|---|---|---|
| ![Login](screenshots/01-login.png) | ![Dashboard hero](screenshots/03-dashboard-hero-preview.png) | ![Dashboard proyectos](screenshots/04-dashboard-proyectos.png) |

| Portafolio — Hero | Portafolio — Tema claro | Portafolio — Experiencia |
|---|---|---|
| ![Portafolio hero](screenshots/11-portafolio-hero.png) | ![Tema claro](screenshots/17-portafolio-tema-claro.png) | ![Experiencia](screenshots/14-portafolio-experiencia.png) |

Más capturas disponibles en [`screenshots/`](screenshots/).

### Verificación y pruebas

No hay suite de pruebas automatizada (proyecto sin framework/build step). La
verificación se hace:

- `php -l` sobre cada archivo tocado antes de dar por buena cualquier
  entrega, para atrapar errores de sintaxis.
- Pruebas funcionales directas contra MySQL/HTTP local (crear cuenta,
  verificar correo, login en dos pasos, recuperar contraseña, guardar
  contenido) antes de considerar un cambio terminado.
- Revisión manual en el navegador del flujo completo, en ambos temas, ambos
  idiomas y al menos un ancho de escritorio y uno de celular.

### Limitaciones conocidas

- Sin build/bundler: los archivos CSS/JS se sirven sin minificar ni
  concatenar (aceptable para el tamaño actual del proyecto).
- Sin pruebas automatizadas — la validación es manual en cada cambio.
- Aplicación de un solo administrador: no hay roles, permisos ni
  multiusuario (es intencional, no una limitación a resolver).
- El Content-Security-Policy permite `'unsafe-inline'` en `style-src` y
  `script-src` porque el proyecto usa `style=""` inline y bloques `<script>`
  en varias plantillas — eliminarlo del todo requeriría mover ese código a
  archivos/clases separados.

---

## English

### Description

Single-administrator portfolio site (not multiuser, by design), built so one person can maintain their own professional content without depending on a third-party CMS. The backend is plain PHP 8 with PDO — no framework, no Composer, no build step: files are served as-is by Apache.

**[Screenshots](#screenshots-1)** · **[Installation](#installation-xampp)** · **[Security](#implemented-security-1)**

### Tech stack

| Layer | Technology |
|---|---|
| Backend | Plain PHP 8 + PDO (no framework, no Composer, no build step) |
| Database | MySQL / MariaDB |
| Frontend | HTML + CSS and vanilla JavaScript, organized by file |
| Mail | [Brevo](https://www.brevo.com) (transactional HTTP API, free plan) via plain PHP cURL |
| Config | Environment variables (`.env`), no secrets in versioned code |

No build step or bundler: files are served as-is by Apache, exactly as they
sit in the repository.

Mail is sent over an HTTP API (Brevo) instead of SMTP on purpose: many free
hosts (Google Cloud included) block outbound SMTP ports, but never port
443/HTTPS, which this API uses — so mail sending behaves the same locally as
on a real free-tier host.

### Features

#### Public site (`public/`)
- Hero, projects (with an expanded "flagship" card), skills, experience,
  education, certifications, contact, and a résumé overlay — all rendered
  server-side from the database.
- **ES/EN language switch** with automatic browser-locale detection on the
  first visit, and a smooth fade when switching languages with the button —
  respects `prefers-reduced-motion`. No animation on page load, only on
  click.
- **Persistent light/dark theme**, with `prefers-color-scheme` detection on
  the first visit and a fade-style transition when toggling (no flash on
  page load).
- **Dynamic social links**: added/removed from the dashboard (no fixed
  platform limit); each icon and label is auto-detected by domain
  (LinkedIn, GitHub, X, Instagram, Facebook, YouTube, WhatsApp, Telegram,
  TikTok, Dribbble, or a generic link icon for any other domain).
- **Experience and certifications always in chronological order** (most
  recent first), computed automatically from a real date captured in the
  dashboard — independent of save order.
- **Auto-generated résumé** (`src/Cv.php`): same format as a real résumé,
  100% generated from the dashboard's data, downloadable as PDF.

#### Dashboard (`admin/`)
- Editing of all content through forms that save via AJAX (`api/save.php`),
  CSRF-protected.
- Live preview of the public site (resizable, collapsible, and expandable
  to full screen); hiding it lets the form reclaim the freed space instead
  of leaving it empty. The preview hides the site's header/nav (adds
  nothing inside the panel).
- Sidebar collapsible to icons-only.
- Drag-to-reorder for projects and skill categories. Experience and
  certifications are **not** draggable — their order is automatic by date
  (see above).
- "Chip" input for technologies, metrics, and social links: type and press
  Enter (or paste a list/URL), with duplicate detection.
- **Delete confirmation** via a custom animated modal (not the browser's
  native `window.confirm()`) before removing any project, skill,
  experience entry, or certification.
- "Saving…"/success/error notices as toasts, consistent with the rest of
  the interface — never `alert()`.

#### Manual bilingual content
Every narrative field has an `_en` column in the database; the dashboard
has an "Editing: Español/English" selector to capture both versions. The
site's ES/EN button only shows the matching one — there's no AI or
third-party API auto-translation.

### Project structure

```text
portafolio-marco/
├── public/          → public site (index.php + assets/css, assets/js, uploads)
├── admin/           → private dashboard (login, verify, verify-email, setup,
│                      index, forgot/reset-password) + assets/css, assets/js
├── api/             → JSON endpoints used by the dashboard (portfolio.php, save.php, upload-*.php)
├── src/             → logic: auth.php, Mailer.php, Portfolio.php, Cv.php, db.php,
│                      helpers.php, config.php, logs/ (security audit log,
│                      not servable over HTTP)
├── database/        → schema.sql (structure) + seed.sql (sample content)
├── i18n/            → es.json / en.json (fixed public-interface strings)
├── screenshots/     → screenshots used in this README
├── .env.example     → environment variable template (copy to .env)
└── .htaccess        → serves public/ at the domain root + security headers
                       + dotfile blocking
```

### Installation (XAMPP)

**Requirements:** PHP 8.0+, MySQL/MariaDB, Apache with `mod_rewrite`/`mod_headers`
(any standard XAMPP install includes these).

1. Copy the project into `htdocs/` (e.g. `C:\xampp\htdocs\portafolio-marco`).
2. Create the database and import it:
   ```bash
   mysql -u root -e "CREATE DATABASE portafolio"
   mysql -u root portafolio < database/schema.sql
   mysql -u root portafolio < database/seed.sql   # optional, sample content
   ```
3. Copy `.env.example` to `.env` and fill in your own values (see
   [Environment variables](#environment-variables) below). `.env` is never
   committed to git, and the root `.htaccess` blocks it from being
   downloaded over HTTP.
4. Open `http://localhost/portafolio-marco/admin/setup.php` to create the
   single admin account (the form disappears once an account exists).
   You'll need to confirm your email before you can log in — check your
   inbox.
5. Public site: `http://localhost/portafolio-marco/public/index.php`.
   Dashboard: `http://localhost/portafolio-marco/admin/login.php`.

There's no build step or compile commands — files are served as-is by
Apache.

In production (real domain, `mod_rewrite` on), the root `.htaccess` serves
the public site directly at `https://mydomain.com/` — no need to write
`/public` in the URL (`https://mydomain.com/public/index.php` still works
the same, it's the same page). On local XAMPP, inside a subfolder of
`htdocs`, keep using the `/public/` path as in step 5 (the rewrite assumes
the project lives at the document root).

### Environment variables

Defined in `.env` (see `.env.example`), read by `src/config.php`:

| Variable | Purpose | Default if missing |
|---|---|---|
| `DB_HOST` | MySQL host | `127.0.0.1` |
| `DB_NAME` | Database name | `portafolio` |
| `DB_USER` | MySQL user | `root` |
| `DB_PASS` | MySQL password | *(empty)* |
| `BREVO_API_KEY` | [Brevo](https://www.brevo.com) API key (free plan: 300 emails/day, no card) — Dashboard > SMTP & API > API Keys | *(no default, required to send mail)* |
| `MAIL_FROM_EMAIL` | Sender address — must be the "individual sender" you verified in Brevo | *(no default, required to send mail)* |
| `MAIL_FROM_NAME` | Visible sender name | same as `SITE_NAME` |
| `SITE_NAME` | Site name, used in emails and `<title>` | `Portafolio Web` |
| `SITE_URL` | Real public domain (no trailing `/`, e.g. `https://mydomain.com`), used to build password-reset/email-verification links | *(empty → falls back to the request Host, local-dev only)* |
| `ADMIN_ACCESS_KEY` | Secret key required to open `/admin` (see [Implemented security](#implemented-security-1)) — generate your own with `php -r "echo bin2hex(random_bytes(20));"` | *(empty → `/admin` isn't key-protected, local-dev only)* |

Without `BREVO_API_KEY`/`MAIL_FROM_EMAIL` configured, the site works
normally but no email (account verification, access codes, password reset)
can be sent — all required to log in. Mail is sent through Brevo's HTTP API
instead of SMTP so it keeps working on free hosts that block outbound SMTP
ports (see [Tech stack](#tech-stack)). Brevo's free plan adds a small "Sent
with Brevo" footer to every email — informational, not a bug.

### Using the dashboard

0. **In production**: if you configured `ADMIN_ACCESS_KEY` (see
   [Environment variables](#environment-variables)), the first time you
   need to open `https://mydomain.com/admin/login.php?key=YOUR_KEY`. From
   then on a one-year cookie remembers the browser — no need to repeat the
   key on every visit, and anyone hitting `/admin` without it gets a plain
   404, as if the panel didn't exist.
1. **First run**: `admin/setup.php` creates the single account — the form
   includes its own password-strength meter ("Very weak" to "Very strong"
   levels, with the real policy also enforced server-side).
2. **Email verification**: after creating the account, a confirmation link
   is sent — login stays locked until it's confirmed.
3. **Two-step login**: username or email + password, then a 6-digit code
   emailed to you (with a "remember this device" option for 30 days).
   Every successful login also triggers an email notification.
4. **Edit content**: each sidebar tab maps to a public-site section.
   Changes only persist once you press "Save changes" — before that they
   only live in the browser (with an automatic `localStorage` draft in
   case the page reloads unexpectedly).
5. **Live preview**: the right-hand panel is the real site loaded in an
   iframe, synced on every change without needing to save first.

### Implemented security

- **No secrets in versioned code**: DB credentials and the Brevo API key
  live in `.env` (git-ignored), never in `src/config.php`.
- **`/admin` hidden behind a secret key** (`ADMIN_ACCESS_KEY` in `.env`,
  see [Using the dashboard](#using-the-dashboard)): without it, any URL
  under `/admin/` returns a plain 404 as if it didn't exist — aimed at
  bots/scanners blindly probing `/admin/login.php`, not a replacement for
  the real login (password + 2FA) but an extra layer on top. Email
  verification/password-reset links skip this key: their own single-use
  token already serves that purpose.
- **`.htaccess` blocks direct HTTP access** to any dotfile (`.env`,
  `.gitignore`, etc.), to `database/*.sql`, to `src/*.php`, and to the
  security log — only Apache/PHP can read them internally.
- **Passwords**: minimum 8 characters, rejects passwords from a blocklist
  of the most-leaked/reused ones, matches against the username/email, and
  trivial patterns (repeated, sequential) — validated on both client and
  server (aligned with NIST 800-63B: length and blocklists matter more
  than forcing arbitrary symbol combinations).
- **Mandatory email verification** before the first login (prevents
  accounts created with a nonexistent/someone-else's email).
- **Two-step login** (password + single-use emailed code), temporary
  lockout after repeated failed attempts, "remember device" automatically
  revoked on password reset or logout.
- **Password recovery**: explicit messages ("that username doesn't exist" /
  "that email isn't tied to any account") instead of the typical ambiguous
  anti-enumeration message — a deliberate choice for this single-admin
  project, where that protection adds nothing (only one account can ever
  exist) while making it harder to diagnose typos; the request limit both
  per session (60s cooldown between sends) and per IP (5 per 15 min) still
  applies so it can't be used to probe identifiers or spam emails
  unchecked.
- **CSRF**: header token for the dashboard's AJAX calls, and a hidden-field
  token for the classic authentication forms (login, setup,
  forgot-password, reset, verify).
- **Sessions**: `HttpOnly` + `SameSite=Lax` cookies, session ID
  regeneration after login, automatic logout on inactivity.
- **Custom, consistent email design** (verification, welcome, access code,
  password reset/confirmation, new-login notice) — never generic plain
  text.
- **HTTP headers** (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`) via
  `.htaccess`.
- **Security audit log** in `src/logs/security.log` (failed attempts,
  lockouts, account creation, resets) — never logs raw passwords, codes,
  or tokens.

### Screenshots

| Login | Dashboard — Home + preview | Dashboard — Projects |
|---|---|---|
| ![Login](screenshots/01-login.png) | ![Dashboard hero](screenshots/03-dashboard-hero-preview.png) | ![Dashboard projects](screenshots/04-dashboard-proyectos.png) |

| Portfolio — Hero | Portfolio — Light theme | Portfolio — Experience |
|---|---|---|
| ![Portfolio hero](screenshots/11-portafolio-hero.png) | ![Light theme](screenshots/17-portafolio-tema-claro.png) | ![Experience](screenshots/14-portafolio-experiencia.png) |

More screenshots available in [`screenshots/`](screenshots/).

### Verification and testing

No automated test suite (no framework/build step in this project).
Verification is done through:

- `php -l` on every touched file before considering any change done, to
  catch syntax errors.
- Direct functional testing against local MySQL/HTTP (create account,
  verify email, two-step login, password recovery, save content) before
  calling a change finished.
- Manual browser review of the full flow, in both themes, both languages,
  and at least one desktop and one mobile width.

### Known limitations

- No build/bundler: CSS/JS files are served unminified and unconcatenated
  (acceptable at the project's current size).
- No automated tests — validation is manual on every change.
- Single-administrator app: no roles, permissions, or multiuser support
  (intentional, not a limitation to fix).
- The Content-Security-Policy allows `'unsafe-inline'` in `style-src` and
  `script-src` because the project uses inline `style=""` and `<script>`
  blocks across several templates — removing it entirely would require
  moving that code into separate files/classes.

---

## Licencia / License

Este proyecto se distribuye bajo la licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.

This project is distributed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

<p align="center"><sub>Portafolio personal de Marco Polo Vilchis — Ingeniero en Sistemas Computacionales.<br>Personal portfolio of Marco Polo Vilchis — Computer Systems Engineer.</sub></p>
