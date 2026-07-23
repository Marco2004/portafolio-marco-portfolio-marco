// Marca <html> como "con JS disponible" para que el CSS pueda diferenciar
// progressive-enhancement (selectores ".has-js"). Servido como archivo
// externo (antes era un <script> inline de una sola línea) para que la CSP
// pueda quitar 'unsafe-inline' de script-src.
document.documentElement.classList.add('has-js');
// "no-js" viene puesto por defecto en el <html> que manda el servidor (ver
// public/index.php) — si este script llega a correr, quita esa clase para
// que scroll-reveal.js sea quien controle [data-reveal] normalmente. Si el
// script NO corre (JS deshabilitado, error de red, bloqueador), "no-js" se
// queda puesto y el CSS de animations.css deja ese contenido visible sin
// depender de JS (antes esa clase nunca la ponía nadie, así que ese
// respaldo era código muerto: sin JS, todo [data-reveal] se quedaba
// invisible para siempre).
document.documentElement.classList.remove('no-js');
