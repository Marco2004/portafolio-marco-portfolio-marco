// Marca <html> como "con JS disponible" para que el CSS pueda diferenciar
// progressive-enhancement (selectores ".has-js"). Servido como archivo
// externo (antes era un <script> inline de una sola línea) para que la CSP
// pueda quitar 'unsafe-inline' de script-src.
document.documentElement.classList.add('has-js');
