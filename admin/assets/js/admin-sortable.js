/**
 * Arrastrar-para-reordenar genérico para las listas repetibles del dashboard
 * (proyectos, habilidades, idiomas, contactos, ficha rápida, botones de
 * proyecto, certificaciones antes de que pasaran a orden automático).
 *
 * Antes usaba drag & drop nativo de HTML5 (draggable="true" + dragstart/
 * dragover/drop). Se reemplazó por Pointer Events propios porque el nativo
 * resultó poco confiable en la práctica: en varios navegadores un <svg>
 * dentro de un contenedor draggable="true" compite por su propio gesto de
 * "arrastrar esta imagen", y dragover/drop podían simplemente no dispararse
 * según en qué pixel exacto empezara el arrastre — nada de esto pasa con
 * Pointer Events, que se manejan a mano de principio a fin sin depender de
 * que el navegador reconozca un gesto de arrastre nativo.
 *
 * Sigue delegado en el contenedor (un solo listener por lista, no uno por
 * fila) por la misma razón que antes: cada renderXxx() de admin-forms.js
 * reconstruye el innerHTML completo al agregar/quitar/cambiar de idioma, así
 * que atar listeners por fila obligaría a re-atarlos después de cada render.
 */
(function () {
  var DRAG_THRESHOLD = 4; // px — evita que un simple clic en el grip se confunda con un arrastre

  // Traga el próximo "click" que le llegue a `document`, sin importar en qué
  // elemento caiga — se registra en fase de captura para actuar antes que
  // cualquier otro listener (p. ej. el de plegar/desplegar tarjetas), y se
  // quita solo después de una sola vez. Compartido entre todas las
  // instancias de attachSortable (una lista distinta también puede terminar
  // bajo el cursor tras un reordenamiento), así que vive fuera de
  // attachSortable en vez de un flag por lista.
  function suppressNextClick() {
    function swallow(e) {
      e.stopPropagation();
      e.preventDefault();
      document.removeEventListener('click', swallow, true);
    }
    document.addEventListener('click', swallow, true);
  }

  // excludeSelector: para listas anidadas (habilidades dentro de una
  // categoría, botones dentro de un proyecto) — la lista externa (categorías,
  // proyectos) y la interna (habilidades de esa categoría, botones de ese
  // proyecto) comparten el mismo contenedor donde burbujea el evento
  // "pointerdown", así que sin esto arrastrar el grip de una fila interna
  // también dispararía el reordenamiento de la fila externa que la contiene.
  function attachSortable(container, rowSelector, getArray, render, excludeSelector) {
    var drag = null; // { row, startIndex, pointerId, overRow }

    function rowsInOrder() {
      return Array.prototype.slice.call(container.querySelectorAll(rowSelector));
    }

    function clearDragOver() {
      container.querySelectorAll('.drag-over').forEach(function (el) {
        el.classList.remove('drag-over');
      });
    }

    // Dado un puntero en (clientY), decide sobre qué fila "soltaría" —
    // compara contra el punto medio de cada fila en vez de sus bordes, así
    // basta con cruzar la mitad de la siguiente fila para que el indicador
    // salte a ella (se siente más responsive que esperar a cruzarla entera).
    function rowAtPoint(clientY, rows) {
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i].getBoundingClientRect();
        if (clientY < r.top + r.height / 2) return rows[i];
      }
      return rows[rows.length - 1] || null;
    }

    // Miniatura que sigue al puntero mientras se arrastra (como al arrastrar
    // un archivo en el explorador de Windows) — la fila real se queda en su
    // lugar solo como referencia atenuada (.is-dragging), la que "se mueve"
    // de verdad visualmente es esta. Para .repeat-card (que pueden venir
    // abiertas y muy altas) solo se clona la cabecera — arrastrar la tarjeta
    // completa abierta se vería como cargar un formulario entero pegado al
    // cursor; para .mini-row (ya compactas) se clona la fila tal cual.
    function buildGhost(row, pointerX, pointerY) {
      var source = row.querySelector('.repeat-card__head') || row;
      var rect = source.getBoundingClientRect();
      var ghost = source.cloneNode(true);
      ghost.classList.add('drag-ghost');
      ghost.removeAttribute('data-drag-handle');
      ghost.style.width = rect.width + 'px';
      ghost.style.height = rect.height + 'px';
      ghost.style.left = rect.left + 'px';
      ghost.style.top = rect.top + 'px';
      // El botón de plegar/desplegar y "Eliminar" quedan clonados pero
      // inertes (pointer-events:none en el propio .drag-ghost) — es una
      // instantánea visual, no una fila funcional.
      document.body.appendChild(ghost);
      return {
        el: ghost,
        // Desplazamiento entre el punto donde se agarró y la esquina de la
        // miniatura, para que se mueva pegada al cursor en vez de saltar a
        // que su esquina quede exactamente bajo el puntero.
        offsetX: pointerX - rect.left,
        offsetY: pointerY - rect.top,
      };
    }

    function moveGhost(ghost, pointerX, pointerY) {
      ghost.el.style.left = (pointerX - ghost.offsetX) + 'px';
      ghost.el.style.top = (pointerY - ghost.offsetY) + 'px';
    }

    function onPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return; // solo clic principal
      if (excludeSelector && e.target.closest(excludeSelector)) return;
      var handle = e.target.closest('[data-drag-handle]');
      if (!handle) return;
      var row = handle.closest(rowSelector);
      if (!row || !container.contains(row)) return;

      drag = {
        row: row,
        startIndex: Number(row.dataset.index),
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        active: false,
        overRow: null,
      };
      // No se llama a setPointerCapture todavía — se hace en cuanto se
      // confirma que sí es un arrastre (ver onPointerMove), para no robarle
      // el puntero a un simple clic.
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
      document.addEventListener('pointercancel', onPointerUp);
    }

    function onPointerMove(e) {
      if (!drag || e.pointerId !== drag.pointerId) return;
      if (!drag.active) {
        var dx = e.clientX - drag.startX;
        var dy = e.clientY - drag.startY;
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
        drag.active = true;
        drag.row.classList.add('is-dragging');
        document.body.classList.add('is-drag-reordering');
        drag.ghost = buildGhost(drag.row, e.clientX, e.clientY);
        try { drag.row.setPointerCapture(drag.pointerId); } catch (err) { /* algunos navegadores no lo permiten sobre el handle si el target cambió — no es crítico */ }
      }
      e.preventDefault();
      moveGhost(drag.ghost, e.clientX, e.clientY);

      var rows = rowsInOrder();
      var target = rowAtPoint(e.clientY, rows);
      if (target !== drag.overRow) {
        clearDragOver();
        drag.overRow = target;
        if (target && target !== drag.row) target.classList.add('drag-over');
      }
    }

    function onPointerUp(e) {
      if (!drag || e.pointerId !== drag.pointerId) return;
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);

      var wasActive = drag.active;
      var overRow = drag.overRow;
      var startIndex = drag.startIndex;
      drag.row.classList.remove('is-dragging');
      document.body.classList.remove('is-drag-reordering');
      if (drag.ghost) drag.ghost.el.remove();
      clearDragOver();
      drag = null;

      // El navegador dispara un "click" normal justo después de soltar,
      // dirigido a lo que sea que haya quedado bajo el cursor — y como
      // render() reordena el DOM, ahí puede haber terminado el botón de
      // plegar/desplegar de OTRA fila (los botones quedan en la misma
      // posición horizontal en todas). Sin esto, soltar un arrastre podía
      // abrir/cerrar esa tarjeta como efecto secundario no pedido.
      if (wasActive) suppressNextClick();

      if (!wasActive || !overRow) return;
      var dropIndex = Number(overRow.dataset.index);
      if (dropIndex === startIndex) return;

      var arr = getArray();
      var moved = arr.splice(startIndex, 1)[0];
      arr.splice(dropIndex, 0, moved);
      render();
      window.MPVAdmin.notifyChange(true);
    }

    // Alternativa por teclado al arrastre con puntero de arriba — sin esto,
    // reordenar estas listas era imposible sin mouse/touch (la manija era
    // aria-hidden y solo escuchaba pointerdown). Con foco en la manija
    // (ver GRIP_HANDLE_HTML en admin-forms.js, ahora role="button"
    // tabindex="0"), flecha arriba/abajo intercambia la fila con su vecina
    // y mueve el foco con ella para no perderlo tras el render().
    function onKeyDown(e) {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      if (excludeSelector && e.target.closest(excludeSelector)) return;
      var handle = e.target.closest('[data-drag-handle]');
      if (!handle) return;
      var row = handle.closest(rowSelector);
      if (!row || !container.contains(row)) return;
      e.preventDefault();

      var fromIndex = Number(row.dataset.index);
      var toIndex = e.key === 'ArrowUp' ? fromIndex - 1 : fromIndex + 1;
      var arr = getArray();
      if (toIndex < 0 || toIndex >= arr.length) return;

      var moved = arr.splice(fromIndex, 1)[0];
      arr.splice(toIndex, 0, moved);
      render();
      window.MPVAdmin.notifyChange(true);

      var movedRow = rowsInOrder()[toIndex];
      var movedHandle = movedRow && movedRow.querySelector('[data-drag-handle]');
      if (movedHandle) movedHandle.focus();
    }

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('keydown', onKeyDown);
  }

  window.MPVSortable = { attach: attachSortable };
})();
