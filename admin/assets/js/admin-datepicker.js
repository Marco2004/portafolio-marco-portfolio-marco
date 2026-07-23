/**
 * Selector de fecha DD/MM/AA con mini-calendario animado, para Experiencia,
 * Certificaciones y Educación (punto 6) — el admin ya no escribe la fecha
 * dos veces (un texto libre para lo que se muestra + un <input type="month">
 * aparte solo para ordenar): la captura una sola vez aquí (año de 2 dígitos
 * interpretado como 20XX) y el texto que se muestra se genera solo, tanto en
 * la vista previa instantánea del propio Dashboard (funciones de abajo) como
 * al guardar de verdad (format_date_range()/format_es_date_long() en
 * src/helpers.php son la fuente de verdad real — esta es su misma lógica
 * repetida en JS, misma duplicación intencional que ya existe para íconos y
 * detección de plataforma).
 *
 * Guarda el valor real como ISO (YYYY-MM-DD) en un <input type="hidden"
 * data-field="..."> — así el resto del dashboard (el listener genérico de
 * "input" de cada sección) lo trata exactamente igual que cualquier otro
 * campo, sin casos especiales.
 */
(function () {
  var MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS_ES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function isoToDDMMYY(iso) {
    if (!iso) return '';
    var parts = iso.split('-');
    if (parts.length !== 3) return '';
    return parts[2] + '/' + parts[1] + '/' + parts[0].slice(2);
  }

  function ddmmyyToIso(text) {
    var m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec((text || '').trim());
    if (!m) return null;
    var day = Number(m[1]), month = Number(m[2]), year = 2000 + Number(m[3]);
    var d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return year + '-' + pad2(month) + '-' + pad2(day);
  }

  function formatEsDateLong(iso, lang) {
    if (!iso) return '';
    var parts = iso.split('-').map(Number);
    if (parts.length !== 3) return '';
    var y = parts[0], m = parts[1] - 1, d = parts[2];
    if (lang === 'en') return MONTHS_EN[m] + ' ' + d + ', ' + y;
    return d + ' de ' + MONTHS_ES[m] + ' de ' + y;
  }

  function formatEsMonthYear(iso, lang) {
    if (!iso) return '';
    var parts = iso.split('-').map(Number);
    if (parts.length !== 3) return '';
    var y = parts[0], m = parts[1] - 1;
    if (lang === 'en') return MONTHS_EN[m] + ' ' + y;
    var es = MONTHS_ES[m];
    return es.charAt(0).toUpperCase() + es.slice(1) + ' de ' + y;
  }

  function formatDateRange(startIso, endIso, lang) {
    var startText = formatEsMonthYear(startIso, lang);
    if (!startText) return '';
    if (!endIso) return startText + (lang === 'en' ? ' — Present' : ' — Presente');
    return startText + ' — ' + formatEsMonthYear(endIso, lang);
  }

  // Espejo de format_duration() en src/helpers.php — mismo criterio que
  // LinkedIn (el mes de inicio ya cuenta como el primer mes trabajado), para
  // que la vista previa del dashboard muestre la misma duración que después
  // se ve en el sitio público.
  function formatDuration(startIso, endIso, lang) {
    if (!startIso) return '';
    var s = startIso.split('-').map(Number);
    var startDate = new Date(s[0], s[1] - 1, s[2] || 1);
    var endDate;
    if (endIso) {
      var e = endIso.split('-').map(Number);
      endDate = new Date(e[0], e[1] - 1, e[2] || 1);
    } else {
      endDate = new Date();
    }
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate) return '';
    var months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth()) + 1;
    var years = Math.floor(months / 12);
    var remMonths = months % 12;
    var parts = [];
    if (lang === 'en') {
      if (years > 0) parts.push(years + ' yr' + (years > 1 ? 's' : ''));
      if (remMonths > 0 || years === 0) parts.push(remMonths + ' mo' + (remMonths !== 1 ? 's' : ''));
    } else {
      if (years > 0) parts.push(years + ' año' + (years > 1 ? 's' : ''));
      if (remMonths > 0 || years === 0) parts.push(remMonths + ' mes' + (remMonths !== 1 ? 'es' : ''));
    }
    return parts.join(' ');
  }

  function html(field, isoValue) {
    return '' +
      '<div class="datepicker" data-datepicker>' +
        '<input type="hidden" data-field="' + field + '" data-datepicker-hidden value="' + (isoValue || '') + '">' +
        '<input type="text" class="input" data-datepicker-text inputmode="numeric" autocomplete="off" aria-label="Fecha (DD/MM/AA)" placeholder="DD/MM/AA" maxlength="8" value="' + isoToDDMMYY(isoValue) + '">' +
      '</div>';
  }

  // Navegación "profesional" día→mes→año: en vez de tener que darle a las
  // flechitas mes por mes hasta llegar a una fecha muy lejana, se hace clic
  // en la etiqueta (p. ej. "julio 2026") para subir un nivel: primero a una
  // grilla de meses del año en curso, luego a una grilla de años (bloques de
  // 12) — mismo patrón que Google Calendar/date pickers nativos. Elegir un
  // año baja a meses, elegir un mes baja a días.
  function buildHead(label, onPrevAttr, onNextAttr, clickable) {
    return '' +
      '<div class="datepicker-cal__head">' +
        '<button type="button" class="datepicker-cal__nav" ' + onPrevAttr + ' aria-label="Anterior">&lsaquo;</button>' +
        '<' + (clickable ? 'button type="button" data-datepicker-zoom-out' : 'span') + ' class="datepicker-cal__label' + (clickable ? ' datepicker-cal__label--clickable' : '') + '">' + label + '</' + (clickable ? 'button' : 'span') + '>' +
        '<button type="button" class="datepicker-cal__nav" ' + onNextAttr + ' aria-label="Siguiente">&rsaquo;</button>' +
      '</div>';
  }

  function buildDaysHtml(viewYear, viewMonth, selectedIso) {
    var first = new Date(viewYear, viewMonth, 1);
    var startWeekday = (first.getDay() + 6) % 7; // lunes=0
    var daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    var todayIso = new Date().toISOString().slice(0, 10);

    var cells = '';
    for (var i = 0; i < startWeekday; i++) {
      cells += '<span class="datepicker-cal__cell datepicker-cal__cell--empty"></span>';
    }
    for (var day = 1; day <= daysInMonth; day++) {
      var iso = viewYear + '-' + pad2(viewMonth + 1) + '-' + pad2(day);
      var isSelected = iso === selectedIso;
      var classes = 'datepicker-cal__cell';
      if (isSelected) classes += ' is-selected';
      if (iso === todayIso) classes += ' is-today';
      cells += '<button type="button" class="' + classes + '" data-datepicker-day="' + iso + '"' +
        ' aria-label="' + day + ' de ' + MONTHS_ES[viewMonth] + ' de ' + viewYear + '"' +
        ' aria-pressed="' + (isSelected ? 'true' : 'false') + '"' +
        (iso === todayIso ? ' aria-current="date"' : '') +
        '>' + day + '</button>';
    }

    return '' +
      '<div class="datepicker-cal" role="group" aria-label="Selector de fecha">' +
        buildHead(MONTHS_ES[viewMonth] + ' ' + viewYear, 'data-datepicker-prev', 'data-datepicker-next', true) +
        '<div class="datepicker-cal__weekdays">' + WEEKDAYS_ES.map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div>' +
        '<div class="datepicker-cal__grid">' + cells + '</div>' +
      '</div>';
  }

  function buildMonthsHtml(viewYear, selectedIso) {
    var selYear = selectedIso ? Number(selectedIso.split('-')[0]) : null;
    var selMonth = selectedIso ? Number(selectedIso.split('-')[1]) - 1 : null;
    var now = new Date();
    var cells = '';
    for (var m = 0; m < 12; m++) {
      var classes = 'datepicker-cal__cell datepicker-cal__cell--month';
      var isSelected = viewYear === selYear && m === selMonth;
      var isCurrent = viewYear === now.getFullYear() && m === now.getMonth();
      if (isSelected) classes += ' is-selected';
      if (isCurrent) classes += ' is-today';
      cells += '<button type="button" class="' + classes + '" data-datepicker-month="' + m + '"' +
        ' aria-label="' + MONTHS_ES[m] + ' de ' + viewYear + '"' +
        ' aria-pressed="' + (isSelected ? 'true' : 'false') + '"' +
        (isCurrent ? ' aria-current="date"' : '') +
        '>' + MONTHS_ES[m].slice(0, 3) + '</button>';
    }
    return '' +
      '<div class="datepicker-cal" role="group" aria-label="Selector de mes">' +
        buildHead(String(viewYear), 'data-datepicker-prev-year', 'data-datepicker-next-year', true) +
        '<div class="datepicker-cal__grid datepicker-cal__grid--months">' + cells + '</div>' +
      '</div>';
  }

  function buildYearsHtml(yearsStart, selectedIso) {
    var selYear = selectedIso ? Number(selectedIso.split('-')[0]) : null;
    var nowYear = new Date().getFullYear();
    var cells = '';
    for (var y = yearsStart; y < yearsStart + 12; y++) {
      var classes = 'datepicker-cal__cell datepicker-cal__cell--year';
      var isSelected = y === selYear;
      var isCurrent = y === nowYear;
      if (isSelected) classes += ' is-selected';
      if (isCurrent) classes += ' is-today';
      cells += '<button type="button" class="' + classes + '" data-datepicker-year="' + y + '"' +
        ' aria-pressed="' + (isSelected ? 'true' : 'false') + '"' +
        (isCurrent ? ' aria-current="date"' : '') +
        '>' + y + '</button>';
    }
    return '' +
      '<div class="datepicker-cal" role="group" aria-label="Selector de año">' +
        buildHead(yearsStart + '–' + (yearsStart + 11), 'data-datepicker-prev-decade', 'data-datepicker-next-decade', false) +
        '<div class="datepicker-cal__grid datepicker-cal__grid--years">' + cells + '</div>' +
      '</div>';
  }

  function buildCalendarHtml(view, selectedIso) {
    if (view.mode === 'years') return buildYearsHtml(view.yearsStart, selectedIso);
    if (view.mode === 'months') return buildMonthsHtml(view.y, selectedIso);
    return buildDaysHtml(view.y, view.m, selectedIso);
  }

  // Registro de instancias vivas para el click-fuera-cierra/Escape-cierra de
  // abajo — antes cada enhanceOne() agregaba sus PROPIOS dos listeners en
  // `document` (uno de click, uno de keydown) sin quitarlos nunca. Como
  // renderExperience()/renderEducationEntries()/renderCerts() en
  // admin-forms.js reconstruyen su contenedor entero con innerHTML en cada
  // alta/baja de fila y en cada cambio de idioma de edición, cada
  // reconstrucción creaba datepickers nuevos y sumaba dos listeners más a
  // `document` — permanentes, nunca liberados, acumulándose durante toda la
  // sesión de edición. Ahora hay un solo listener de cada tipo para toda la
  // página, que recorre esta lista (y se auto-limpia de wraps que ya no
  // están en el DOM, sin necesitar que nadie los quite a mano).
  var instances = [];

  // Fase de burbujeo normal, sin cortar la propagación — mismo motivo que el
  // ajuste equivalente en admin-combo.js: el calendario (.datepicker-popup)
  // es HIJO de .datepicker, así que un clic que caiga visualmente sobre él
  // siempre resuelve a algo DENTRO de ese wrap (wrap.contains(e.target) ya
  // lo cubre) — nunca "atraviesa" al calendario para activar algo detrás en
  // el DOM. Cortar la propagación aquí se tragaba clics legítimos en
  // botones totalmente ajenos (p. ej. "Guardar cambios") si el admin los
  // clickeaba con cualquier calendario todavía abierto, sin ningún aviso.
  // e.composedPath() (no wrap.contains(e.target)) a propósito: cambiar de
  // vista día→mes→año (zoom-out) o elegir un mes/año dispara
  // rerenderCalendar(), que reemplaza el innerHTML del calendario EN EL
  // MISMO click — el botón que originó el evento queda desconectado del DOM
  // antes de que este listener llegue a correr. wrap.contains() sobre un
  // nodo ya desconectado siempre da false ("está afuera"), así que cambiar
  // de vista cerraba el calendario en vez de mostrar la vista nueva.
  // composedPath() congela la ruta original del evento antes de esa
  // mutación, así que sigue siendo correcta pase lo que pase con el DOM
  // después (mismo ajuste que ya se hizo en public/assets/js/nav-menu.js,
  // mismo bug de fondo: un handler que reemplaza innerHTML del propio
  // elemento clickeado antes de que el listener de "clic afuera" corra).
  document.addEventListener('click', function (e) {
    instances = instances.filter(function (inst) { return document.body.contains(inst.wrap); });
    var path = typeof e.composedPath === 'function' ? e.composedPath() : [e.target];
    instances.forEach(function (inst) {
      if (inst.isOpen() && path.indexOf(inst.wrap) === -1) inst.close();
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    instances = instances.filter(function (inst) { return document.body.contains(inst.wrap); });
    instances.forEach(function (inst) {
      if (inst.isOpen()) inst.close();
    });
  });

  function enhanceOne(wrap) {
    if (wrap.dataset.datepickerBound) return;
    wrap.dataset.datepickerBound = '1';

    var hidden = wrap.querySelector('[data-datepicker-hidden]');
    var text = wrap.querySelector('[data-datepicker-text]');
    var calendarEl = null;
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var view = { y: 0, m: 0, mode: 'days', yearsStart: 0 };

    function syncViewToValue() {
      if (hidden.value) {
        var p = hidden.value.split('-').map(Number);
        view.y = p[0]; view.m = p[1] - 1;
      } else {
        var now = new Date();
        view.y = now.getFullYear(); view.m = now.getMonth();
      }
      view.mode = 'days';
    }

    function closeCalendar() {
      if (!calendarEl) return;
      var el = calendarEl;
      calendarEl = null;
      if (reduceMotion) { el.remove(); return; }
      el.classList.add('is-closing');
      setTimeout(function () { el.remove(); }, 140);
    }

    function rerenderCalendar() {
      if (!calendarEl) return;
      calendarEl.innerHTML = buildCalendarHtml(view, hidden.value);
    }

    function openCalendar() {
      if (calendarEl) return;
      syncViewToValue();
      calendarEl = document.createElement('div');
      calendarEl.className = 'datepicker-popup';
      calendarEl.innerHTML = buildCalendarHtml(view, hidden.value);
      wrap.appendChild(calendarEl);
      // Por defecto se ancla a la izquierda (left:0, ver CSS). En viewports
      // angostos (móvil) un campo que quede cerca del borde derecho puede
      // hacer que el popup (230px) se salga de la pantalla — si eso pasa, se
      // ancla por la derecha en su lugar (right:0), que sí cabe porque nunca
      // es más ancho que el propio .datepicker que lo contiene menos su
      // propio ancho... en la práctica basta con probar si se sale y voltear.
      var rect = calendarEl.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        calendarEl.style.left = 'auto';
        calendarEl.style.right = '0';
      }
      if (!reduceMotion) {
        calendarEl.classList.add('is-opening');
        requestAnimationFrame(function () { calendarEl.classList.remove('is-opening'); });
      }
    }

    function setIso(iso) {
      hidden.value = iso || '';
      text.value = isoToDDMMYY(iso);
      hidden.dispatchEvent(new Event('input', { bubbles: true }));
    }

    text.addEventListener('focus', openCalendar);
    text.addEventListener('click', openCalendar);

    text.addEventListener('input', function () {
      var digits = text.value.replace(/[^0-9]/g, '').slice(0, 6);
      var masked = digits;
      if (digits.length > 4) masked = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4);
      else if (digits.length > 2) masked = digits.slice(0, 2) + '/' + digits.slice(2);
      text.value = masked;
      var iso = ddmmyyToIso(masked);
      if (iso) {
        hidden.value = iso;
        hidden.dispatchEvent(new Event('input', { bubbles: true }));
        syncViewToValue();
        rerenderCalendar();
      }
    });

    wrap.addEventListener('click', function (e) {
      var dayBtn = e.target.closest('[data-datepicker-day]');
      if (dayBtn) {
        setIso(dayBtn.getAttribute('data-datepicker-day'));
        closeCalendar();
        return;
      }

      // Días: mes anterior/siguiente. Meses: año anterior/siguiente. Años:
      // década anterior/siguiente (bloques de 12). Cada nivel pagina en su
      // propia unidad para no tener que cruzar niveles con las flechitas.
      if (e.target.closest('[data-datepicker-prev]')) {
        view.m--; if (view.m < 0) { view.m = 11; view.y--; }
        rerenderCalendar();
        return;
      }
      if (e.target.closest('[data-datepicker-next]')) {
        view.m++; if (view.m > 11) { view.m = 0; view.y++; }
        rerenderCalendar();
        return;
      }
      if (e.target.closest('[data-datepicker-prev-year]')) {
        view.y--;
        rerenderCalendar();
        return;
      }
      if (e.target.closest('[data-datepicker-next-year]')) {
        view.y++;
        rerenderCalendar();
        return;
      }
      if (e.target.closest('[data-datepicker-prev-decade]')) {
        view.yearsStart -= 12;
        rerenderCalendar();
        return;
      }
      if (e.target.closest('[data-datepicker-next-decade]')) {
        view.yearsStart += 12;
        rerenderCalendar();
        return;
      }

      // Clic en la etiqueta: sube un nivel (días→meses→años). Elegir un año
      // o un mes baja un nivel de vuelta.
      if (e.target.closest('[data-datepicker-zoom-out]')) {
        view.mode = (view.mode === 'months') ? 'years' : 'months';
        if (view.mode === 'years') view.yearsStart = view.y - 5;
        rerenderCalendar();
        return;
      }
      var yearBtn = e.target.closest('[data-datepicker-year]');
      if (yearBtn) {
        view.y = Number(yearBtn.getAttribute('data-datepicker-year'));
        view.mode = 'months';
        rerenderCalendar();
        return;
      }
      var monthBtn = e.target.closest('[data-datepicker-month]');
      if (monthBtn) {
        view.m = Number(monthBtn.getAttribute('data-datepicker-month'));
        view.mode = 'days';
        rerenderCalendar();
      }
    });

    instances.push({
      wrap: wrap,
      isOpen: function () { return !!calendarEl; },
      close: closeCalendar,
    });
  }

  function enhance(container) {
    container.querySelectorAll('[data-datepicker]').forEach(enhanceOne);
  }

  window.MPVDatepicker = {
    html: html,
    enhance: enhance,
    formatEsDateLong: formatEsDateLong,
    formatEsMonthYear: formatEsMonthYear,
    formatDateRange: formatDateRange,
    formatDuration: formatDuration,
    isoToDDMMYY: isoToDDMMYY,
  };
})();
