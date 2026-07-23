/**
 * Combo de texto libre + lista de sugerencias flotante siempre visible (ver
 * nivel de habilidad en admin-forms.js) — reemplaza el <datalist> nativo:
 * con datalist, en cuanto el campo ya tenía texto escrito el navegador solo
 * mostraba las opciones que empezaban igual (o ninguna), obligando a borrar
 * todo para volver a ver la lista completa. Aquí el panel siempre muestra
 * todas las opciones, sin filtrar por lo ya escrito — el campo sigue siendo
 * texto libre, elegir una opción solo lo rellena.
 *
 * Genérico: cualquier `.combo[data-combo]` con un [data-combo-input],
 * [data-combo-toggle] y [data-combo-panel] adentro funciona, no está atado
 * a un solo uso.
 */
window.MPVCombo = (function () {
  var globalListenerBound = false;

  function setExpanded(combo, expanded) {
    var value = expanded ? 'true' : 'false';
    var toggle = combo.querySelector('[data-combo-toggle]');
    var input = combo.querySelector('[data-combo-input]');
    if (toggle) toggle.setAttribute('aria-expanded', value);
    if (input) input.setAttribute('aria-expanded', value);
  }

  function closeCombo(combo) {
    combo.classList.remove('is-open');
    var panel = combo.querySelector('[data-combo-panel]');
    if (panel) panel.hidden = true;
    setExpanded(combo, false);
  }

  function closeAll() {
    document.querySelectorAll('.combo.is-open').forEach(closeCombo);
  }

  // Un solo listener a nivel documento para "cerrar al hacer clic afuera" y
  // Escape, sin importar cuántos combos existan o se vuelvan a dibujar — así
  // renderSkills() (que reconstruye el DOM en cada cambio) nunca acumula un
  // listener nuevo por cada render, solo evalúa cuáles siguen abiertos en
  // ese momento.
  function bindGlobalHandlers() {
    if (globalListenerBound) return;
    globalListenerBound = true;
    // Fase de burbujeo normal, sin cortar la propagación — el panel flotante
    // (.combo__panel) es HIJO de .combo, así que un clic que caiga
    // visualmente sobre el panel siempre resuelve e.target a algo DENTRO de
    // .combo (combo.contains(e.target) ya lo cubre); nunca "atraviesa" al
    // panel para activar lo que esté detrás en el DOM, eso ya lo garantiza
    // el propio navegador. Cortar la propagación aquí (como hacía una
    // versión anterior de este archivo) terminaba tragándose clics
    // legítimos en botones totalmente ajenos al combo — p. ej. "Guardar
    // cambios" dejaba de funcionar si el admin lo clickeaba con cualquier
    // combo todavía abierto en la página, sin ningún aviso de error. El bug
    // real que esto perseguía arreglar (agregar una habilidad sin querer al
    // cerrar el combo) era por el área de clic sobredimensionada del botón
    // "+ Agregar…" (ver .add-link en admin-forms.css), ya corregida ahí.
    document.addEventListener('click', function (e) {
      document.querySelectorAll('.combo.is-open').forEach(function (combo) {
        if (!combo.contains(e.target)) closeCombo(combo);
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAll();
    });
  }

  function enhance(root) {
    bindGlobalHandlers();
    (root || document).querySelectorAll('[data-combo]').forEach(function (combo) {
      if (combo.dataset.comboBound) return;
      combo.dataset.comboBound = '1';
      var input = combo.querySelector('[data-combo-input]');
      var toggle = combo.querySelector('[data-combo-toggle]');
      var panel = combo.querySelector('[data-combo-panel]');
      if (!input || !toggle || !panel) return;

      function open() {
        closeAll();
        combo.classList.add('is-open');
        panel.hidden = false;
        setExpanded(combo, true);
      }

      toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        if (combo.classList.contains('is-open')) closeCombo(combo); else open();
      });
      input.addEventListener('focus', open);
      panel.addEventListener('mousedown', function (e) {
        // La ✕ de "olvidar" (si la opción la tiene) se maneja aparte, en el
        // listener de 'click' de abajo — no cuenta como elegir la opción.
        if (e.target.closest('[data-combo-option-delete]')) return;
        // mousedown (no click) para elegir la opción antes de que el input
        // pierda el foco y el listener global de "clic afuera" alcance a
        // cerrar el panel primero.
        var opt = e.target.closest('[data-combo-option]');
        if (!opt) return;
        e.preventDefault();
        input.value = opt.getAttribute('data-combo-option');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        closeCombo(combo);
        input.focus();
      });
      // Las opciones son role="button" tabindex="0" (ver skillLevelOptionsHtml()
      // en admin-forms.js) para que Tab pueda alcanzarlas, pero a diferencia
      // de un <button> real eso no activa nada con Enter/Espacio por su
      // cuenta — sin este listener quedaban enfocables pero inertes para
      // quien navega solo con teclado. Mismo criterio de selección que el
      // mousedown de arriba, sin tocar la ✕ (que ya es un <button> real y
      // responde a Enter/Espacio de forma nativa).
      panel.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        if (e.target.closest('[data-combo-option-delete]')) return;
        var opt = e.target.closest('[data-combo-option]');
        if (!opt) return;
        e.preventDefault();
        input.value = opt.getAttribute('data-combo-option');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        closeCombo(combo);
        input.focus();
      });
      // La ✕ de "olvidar" un nivel personalizado no decide nada por sí sola
      // (no sabe qué significa "olvidar" para quien esté usando este combo
      // genérico) — solo avisa con un evento propio; quien haya montado el
      // combo (admin-forms.js) decide qué hacer, confirma y actualiza sus
      // datos.
      panel.addEventListener('click', function (e) {
        var delBtn = e.target.closest('[data-combo-option-delete]');
        if (!delBtn) return;
        e.stopPropagation();
        // Se cierra ANTES de avisar, no después: quien reciba el evento
        // normalmente va a mostrar un diálogo de confirmación, y mientras
        // ese diálogo esté abierto el combo debe estar cerrado — si se queda
        // "is-open" de fondo, el clic en el botón "Eliminar" del diálogo
        // cuenta como un clic de fuera del combo, y el listener de arriba
        // que cierra combos al hacer clic afuera le corta la propagación a
        // ESE clic también, sin dejar que le llegue nunca al diálogo.
        closeCombo(combo);
        combo.dispatchEvent(new CustomEvent('combo:delete-option', {
          bubbles: true,
          detail: { label: delBtn.getAttribute('data-combo-option-delete') },
        }));
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () { enhance(document); });

  return { enhance: enhance };
})();
