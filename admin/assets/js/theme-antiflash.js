// Script anti-flash para el <head> del Dashboard y las páginas de auth
// (login/setup/forgot-password/reset-password/verify/verify-email). Se
// resuelve antes de pintar nada: elección manual guardada de forma
// permanente en el navegador (localStorage, botón de tema del dashboard o
// del sitio público — misma clave "mpv_theme" para ambos) > preferencia del
// sistema operativo > oscuro (si el navegador no expone
// prefers-color-scheme). Solo se usa el sistema operativo como default la
// primera vez, antes de que exista una elección manual guardada; no hay
// default de base de datos — el tema nunca es algo configurado por el admin
// para otros visitantes (eso no existe, ver el punto de la pestaña
// Apariencia eliminada).
//
// Se sirve como archivo externo (en vez de un <script> inline, como era
// antes) para que la Content-Security-Policy pueda quitar 'unsafe-inline' de
// script-src — el <script src="..."> que lo carga en cada página NO lleva
// defer/async, así que el navegador lo sigue ejecutando de forma síncrona
// antes de pintar, exactamente igual que el bloque inline anterior.
(function () {
  try {
    var m = localStorage.getItem('mpv_theme');
    if (m === 'dark' || m === 'light') {
      document.documentElement.setAttribute('data-theme', m);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
