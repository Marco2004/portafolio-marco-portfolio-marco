// Se resuelve el tema ANTES de pintar nada, para no parpadear entre el
// tema base del servidor y el real. Prioridad: anulación manual guardada
// de forma permanente en el navegador (localStorage, botón del nav) >
// preferencia del sistema (prefers-color-scheme) > tema base que ya trae
// el <html> desde el servidor. No existe un tercer modo "automático"
// guardado.
//
// Servido como archivo externo (antes era un <script> inline) para que la
// Content-Security-Policy pueda quitar 'unsafe-inline' de script-src — el
// <script src="..."> que lo carga no lleva defer/async, así que se sigue
// ejecutando de forma síncrona antes de pintar, igual que el inline
// original. public/index.php sigue omitiendo esta etiqueta por completo en
// modo vista previa (?preview=1), igual que antes.
(function () {
  try {
    var mode = localStorage.getItem('mpv_theme');
    if (mode === 'dark' || mode === 'light') {
      document.documentElement.setAttribute('data-theme', mode);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      document.documentElement.setAttribute('data-theme', 'light');
    }
    // Si ninguna media query resuelve (navegador viejo sin soporte) se
    // queda el data-theme por defecto que ya trae el <html> del servidor.
  } catch (e) {}
})();
