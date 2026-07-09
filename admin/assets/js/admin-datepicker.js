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

  function html(field, isoValue) {
    return '' +
      '<div class="datepicker" data-datepicker>' +
        '<input type="hidden" data-field="' + field + '" data-datepicker-hidden value="' + (isoValue || '') + '">' +
        '<input type="text" class="input" data-datepicker-text inputmode="numeric" autocomplete="off" placeholder="DD/MM/AA" maxlength="8" value="' + isoToDDMMYY(isoValue) + '">' +
      '</div>';
  }

  function buildCalendarHtml(viewYear, viewMonth, selectedIso) {
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
      var classes = 'datepicker-cal__cell';
      if (iso === selectedIso) classes += ' is-selected';
      if (iso === todayIso) classes += ' is-today';
      cells += '<button type="button" class="' + classes + '" data-datepicker-day="' + iso + '">' + day + '</button>';
    }

    return '' +
      '<div class="datepicker-cal">' +
        '<div class="datepicker-cal__head">' +
          '<button type="button" class="datepicker-cal__nav" data-datepicker-prev aria-label="Mes anterior">&lsaquo;</button>' +
          '<span class="datepicker-cal__label">' + MONTHS_ES[viewMonth] + ' ' + viewYear + '</span>' +
          '<button type="button" class="datepicker-cal__nav" data-datepicker-next aria-label="Mes siguiente">&rsaquo;</button>' +
        '</div>' +
        '<div class="datepicker-cal__weekdays">' + WEEKDAYS_ES.map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div>' +
        '<div class="datepicker-cal__grid">' + cells + '</div>' +
      '</div>';
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

  document.addEventListener('click', function (e) {
    instances = instances.filter(function (inst) { return document.body.contains(inst.wrap); });
    instances.forEach(function (inst) {
      if (inst.isOpen() && !inst.wrap.contains(e.target)) inst.close();
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
    var view = { y: 0, m: 0 };

    function syncViewToValue() {
      if (hidden.value) {
        var p = hidden.value.split('-').map(Number);
        view = { y: p[0], m: p[1] - 1 };
      } else {
        var now = new Date();
        view = { y: now.getFullYear(), m: now.getMonth() };
      }
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
      calendarEl.innerHTML = buildCalendarHtml(view.y, view.m, hidden.value);
    }

    function openCalendar() {
      if (calendarEl) return;
      syncViewToValue();
      calendarEl = document.createElement('div');
      calendarEl.className = 'datepicker-popup';
      calendarEl.innerHTML = buildCalendarHtml(view.y, view.m, hidden.value);
      wrap.appendChild(calendarEl);
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
      if (e.target.closest('[data-datepicker-prev]')) {
        view.m--; if (view.m < 0) { view.m = 11; view.y--; }
        rerenderCalendar();
        return;
      }
      if (e.target.closest('[data-datepicker-next]')) {
        view.m++; if (view.m > 11) { view.m = 0; view.y++; }
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
    isoToDDMMYY: isoToDDMMYY,
  };
})();
