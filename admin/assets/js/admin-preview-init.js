// El src del iframe de vista previa se arma aquí (no en el atributo del
// HTML) para poder leer el data-theme que el script anti-flash del <head>
// ya resolvió en <html> (localStorage/sistema) y así la vista previa nazca
// ya con el tema correcto, sin un segundo "reload" del iframe.
//
// Servido como archivo externo (antes era un <script> inline justo después
// del <iframe>) para que la CSP pueda quitar 'unsafe-inline' de script-src.
// document.currentScript sigue apuntando a ESTE <script src="..."> mientras
// se ejecuta de forma síncrona (sin defer/async), igual que pasaba con el
// bloque inline — por eso previousElementSibling sigue resolviendo al
// <iframe> que está justo antes en el HTML.
(function () {
  var f = document.currentScript.previousElementSibling;
  var t = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  f.src = '../public/index.php?preview=1&theme=' + t;
})();
