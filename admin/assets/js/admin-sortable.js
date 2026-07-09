/**
 * Arrastrar-para-reordenar genérico para las listas repetibles del dashboard
 * (proyectos, experiencia, categorías de habilidades, certificaciones).
 *
 * Usa drag & drop nativo de HTML5 delegado en el contenedor en vez de atar
 * un listener por fila: cada renderXxx() de admin-forms.js reconstruye el
 * innerHTML completo (al agregar/quitar/cambiar de idioma), así que atar
 * listeners por fila obligaría a re-atarlos después de cada render. Delegar
 * en el contenedor se ata una sola vez y sigue funcionando sin importar
 * cuántas veces se vuelva a dibujar la lista.
 *
 * La fila entera es draggable="true" desde que se dibuja (así lo puede
 * detectar de forma fiable cualquier simulación de arrastre, incluida la de
 * pruebas automatizadas), pero el arrastre solo se deja completar si
 * empezó sobre el "grip" (data-drag-handle) — si no, se cancela en
 * dragstart. Esto no interfiere con seleccionar texto dentro de un
 * input/textarea: los navegadores ya priorizan la selección de texto sobre
 * el drag nativo del contenedor cuando el mousedown ocurre en un campo.
 */
(function () {
  function attachSortable(container, rowSelector, getArray, render) {
    var dragIndex = null;

    container.addEventListener('dragstart', function (e) {
      var row = e.target.closest(rowSelector);
      if (!row || !e.target.closest('[data-drag-handle]')) {
        e.preventDefault();
        return;
      }
      dragIndex = Number(row.dataset.index);
      row.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(dragIndex)); // requerido por Firefox
    });

    container.addEventListener('dragend', function (e) {
      var row = e.target.closest(rowSelector);
      if (row) {
        row.classList.remove('is-dragging');
      }
      container.querySelectorAll('.drag-over').forEach(function (el) {
        el.classList.remove('drag-over');
      });
      dragIndex = null;
    });

    container.addEventListener('dragover', function (e) {
      var row = e.target.closest(rowSelector);
      if (!row || dragIndex === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      container.querySelectorAll('.drag-over').forEach(function (el) {
        if (el !== row) el.classList.remove('drag-over');
      });
      row.classList.add('drag-over');
    });

    container.addEventListener('drop', function (e) {
      var row = e.target.closest(rowSelector);
      if (!row || dragIndex === null) return;
      e.preventDefault();
      var dropIndex = Number(row.dataset.index);
      row.classList.remove('drag-over');
      if (dropIndex !== dragIndex) {
        var arr = getArray();
        var moved = arr.splice(dragIndex, 1)[0];
        arr.splice(dropIndex, 0, moved);
        render();
        window.MPVAdmin.notifyChange();
      }
      dragIndex = null;
    });
  }

  window.MPVSortable = { attach: attachSortable };
})();
