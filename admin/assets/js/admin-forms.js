(function () {
  var state, utils, getByPath, setByPath, notifyChange;

  // Sufijo aleatorio de una sola vez por carga de página — algunos
  // navegadores (Chrome en particular) siguen sugiriendo valores escritos
  // antes en un campo aunque tenga autocomplete="off", si logran
  // correlacionarlo de alguna forma con un campo que ya vieron. Un name=""
  // que cambia en cada carga de página nunca coincide con nada guardado, así
  // que no hay nada que sugerir — se usa solo en el combo de nivel de
  // habilidad, el único campo de texto libre de esta lista que además tiene
  // su propio menú de opciones (con el que competiría un menú nativo del
  // navegador encima).
  var NO_AUTOFILL_SALT = Math.random().toString(36).slice(2, 8);

  // Definidas una sola vez en admin-escape.js (window.MPVEscape), cargado
  // antes que este archivo — ver ese archivo para el porqué.
  var escapeHtml = window.MPVEscape.html;
  var escapeAttr = window.MPVEscape.attr;

  // Texto de interfaz del Dashboard (etiquetas, placeholders, mensajes de
  // confirmación) — todo lo que este archivo genera por JS pasa por aquí en
  // vez de texto fijo en español, para que cambiar el idioma de interfaz
  // (mpv-admin:langchange, ver admin-i18n.js/admin-sections.js) también
  // traduzca Proyectos/Habilidades/Experiencia/Educación/Contacto, no solo
  // Inicio (que ya usa data-i18n estático en admin/index.php).
  function t(key) {
    return window.MPVAdminI18n ? window.MPVAdminI18n.t(key) : key;
  }
  // Sustituye %PLACEHOLDER% dentro de una cadena ya traducida — mismo patrón
  // que ya usa admin-sections.js para admin.editLangBanner.after (%LANG%).
  function tf(key, replacements) {
    var text = t(key);
    Object.keys(replacements || {}).forEach(function (k) {
      text = text.replace('%' + k + '%', replacements[k]);
    });
    return text;
  }
  function enSuffix() {
    return isEditingEn() ? ' ' + t('admin.forms.enHint') : '';
  }

  // Confirmación específica antes de quitar un bloque completo de contenido
  // (proyecto, categoría, experiencia, certificación). Nombra el elemento
  // real en vez de un "¿Estás seguro?" genérico. El elemento no se borra en
  // el servidor hasta pulsar "Guardar cambios", pero quien edita no tiene
  // por qué saber ese detalle interno — debe sentir la acción como definitiva.
  // Usa el modal propio (admin-confirm-dialog.js) en vez de window.confirm()
  // — nativo, bloqueante y visualmente ajeno al resto del dashboard.
  function confirmRemoval(kindKey, label) {
    var name = (label || '').trim() || t('admin.forms.untitled');
    return window.MPVAdmin.confirmDialog(
      tf('admin.forms.confirmDeleteMsg', { KIND: t(kindKey), NAME: name }),
      { title: t('admin.forms.confirmDeleteTitle'), confirmLabel: t('admin.confirmDialog.confirm') }
    );
  }

  // role="button" tabindex="0" (en vez de aria-hidden, como antes) para que
  // además de arrastrarse con mouse/touch (ver admin-sortable.js) esta
  // manija se pueda alcanzar con Tab y reordenar con flecha arriba/abajo —
  // única forma de reordenar estas listas para quien no usa mouse/touch.
  var GRIP_HANDLE_HTML = '<span class="drag-handle" data-drag-handle role="button" tabindex="0" title="Arrastrar o usar flecha arriba/abajo para reordenar" aria-label="Reordenar: flecha arriba o flecha abajo">' + window.MPVIcons.grip + '</span>';

  /**
   * Acordeón compartido por las listas de tarjetas grandes (Proyectos,
   * categorías de Habilidades, Experiencia, Títulos de Educación) — solo una
   * fila abierta a la vez, para no tener todo expandido al mismo tiempo
   * (punto 14). El estado de apertura vive en el propio objeto de cada fila
   * (item._open), no en un índice aparte: así sobrevive intacto a un
   * reordenamiento por arrastre o a que "el insignia siempre va primero"
   * (pinFlagshipFirst()) reacomode el array — el objeto sigue siendo el
   * mismo, solo cambia de posición. _open nunca se manda al servidor como
   * tal (api/save.php/Portfolio::saveAll() solo leen los campos que
   * reconocen), es puramente de interfaz.
   */
  // "Puesto — Organización" (o solo lo que exista) para identificar una
  // tarjeta de Experiencia/Educación cerrada — se evalúa siempre en español,
  // igual que el resto de las vistas previas dentro del propio dashboard.
  function joinTitleParts(a, b) {
    a = (a || '').trim();
    b = (b || '').trim();
    if (a && b) return a + ' — ' + b;
    return a || b || t('admin.forms.untitled');
  }

  // Orden automático de Experiencia/Educación — mismo criterio que el
  // ORDER BY de Portfolio::getAll() en PHP (ver ese comentario para el
  // porqué completo): "vigente" (con startDate pero sin endDate, es decir
  // isCurrent) siempre va primero sin importar cuándo empezó; entre dos
  // vigentes, o si dos fechas de fin coinciden ("se juntan los meses"), se
  // desempata por startDate; una fila sin ninguna fecha (recién agregada)
  // va al final. Ya no es un orden manual — no hay arrastre en estas dos
  // listas — así que esto corre cada vez que cambia una fecha para que el
  // Dashboard y la vista previa siempre coincidan con lo que mostrará el
  // sitio público.
  function dateSortKey(iso) {
    return iso || '0000-00-00';
  }
  function compareByRecency(a, b) {
    var aTier = !a.startDate ? 2 : (a.isCurrent ? 0 : 1);
    var bTier = !b.startDate ? 2 : (b.isCurrent ? 0 : 1);
    if (aTier !== bTier) return aTier - bTier;
    var aEnd = dateSortKey(a.isCurrent ? '' : a.endDate);
    var bEnd = dateSortKey(b.isCurrent ? '' : b.endDate);
    if (aEnd !== bEnd) return aEnd > bEnd ? -1 : 1;
    var aStart = dateSortKey(a.startDate);
    var bStart = dateSortKey(b.startDate);
    if (aStart !== bStart) return aStart > bStart ? -1 : 1;
    return 0;
  }
  // Certificaciones: una sola fecha (issueDate), sin concepto de "vigente".
  function compareCertsByRecency(a, b) {
    var aDate = dateSortKey(a.issueDate);
    var bDate = dateSortKey(b.issueDate);
    if (aDate !== bDate) return aDate > bDate ? -1 : 1;
    return 0;
  }
  // Reordena in-place con el comparador dado; devuelve true si el orden
  // realmente cambió (para no volver a dibujar la lista sin necesidad,
  // p. ej. mientras el resto de los campos de la fila se sigue editando).
  function resortIfChanged(list, cmp) {
    var before = list.slice();
    list.sort(cmp);
    for (var i = 0; i < list.length; i++) {
      if (list[i] !== before[i]) return true;
    }
    return false;
  }

  function accordionToggleHtml(open) {
    return '<button type="button" class="repeat-card__toggle" data-toggle-collapse aria-expanded="' + (open ? 'true' : 'false') + '" title="' + escapeAttr(t('admin.forms.toggleSection')) + '" aria-label="' + escapeAttr(t('admin.forms.toggleSection')) + '">' + window.MPVIcons.chevronDown + '</button>';
  }

  // Interruptor animado (pista + perilla que se desliza) en vez del checkbox
  // nativo del navegador — mismo <input type="checkbox"> por dentro (los
  // listeners delegados de 'change' que ya leen data-field siguen
  // funcionando sin tocarlos), solo cambia lo visual.
  function checkboxToggleHtml(field, checked, label) {
    return '' +
      '<label class="toggle-switch">' +
        '<input type="checkbox" class="toggle-switch__input" data-field="' + field + '"' + (checked ? ' checked' : '') + '>' +
        '<span class="toggle-switch__track"><span class="toggle-switch__thumb"></span></span>' +
        '<span class="toggle-switch__label">' + escapeHtml(label) + '</span>' +
      '</label>';
  }

  // Abre una fila por defecto SOLO la primera vez que se carga la página
  // (nada tiene _open todavía) — para que el panel no se vea totalmente
  // plegado al entrar. A propósito se llama una sola vez desde el init (ver
  // más abajo), no desde dentro de cada renderXxx(): el admin pidió control
  // manual total — agregar, quitar, arrastrar o cambiar de idioma de edición
  // NUNCA debe abrir ni cerrar nada por su cuenta, ni siquiera "por si acaso
  // queda todo cerrado". Si el admin cierra todas las tarjetas a propósito,
  // eso se queda así.
  function ensureOneOpen(list, preferIndex) {
    if (!list.length) return;
    if (list.some(function (item) { return item._open; })) return;
    list.forEach(function (item) { item._open = false; });
    list[preferIndex != null ? preferIndex : 0]._open = true;
  }

  // Aplica el estado abierto/cerrado a UNA tarjeta (la que de verdad cambió
  // en este clic) — cada tarjeta es independiente ahora, así que no hay
  // motivo para volver a tocar (ni re-medir/re-animar) las demás en cada
  // clic como antes.
  function applyAccordionState(card, item, getTitle) {
    var open = !!(item && item._open);
    var body = card.querySelector('.repeat-card__body');
    // La clase se quita/pone ANTES de llamar a collapseBody() (mismo orden
    // que ya usa el toggle de las tarjetas estáticas en
    // admin-card-collapse.js) — si no, al abrir, collapseBody() mide el
    // destino con .is-collapsed todavía puesto en la tarjeta: esa clase
    // fuerza padding-top/padding-bottom a 0 con más especificidad que la
    // regla base, así que limpiar solo el padding en línea para medir el
    // valor natural no bastaba — seguía cayendo en el padding:0 de la clase
    // y el destino medido salía ~36px corto. Eso no se notaba en el momento
    // (la tarjeta "terminaba" de abrir en ese destino corto) pero sí un
    // instante después, cuando el cleanup de collapseBody() quita el límite
    // del todo y el contenido salta a su tamaño real — el "abre y luego se
    // reacomoda" que se sentía como dos pasos.
    card.classList.toggle('is-collapsed', !open);
    // Alto exacto medido (no un tope fijo en CSS) — ver collapseBody() en
    // admin-card-collapse.js, mismo helper que usan las tarjetas estáticas.
    if (body && window.MPVAdmin && window.MPVAdmin.collapseBody) {
      window.MPVAdmin.collapseBody(body, open);
    }
    var toggleBtn = card.querySelector('[data-toggle-collapse]');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (getTitle) {
      var titleEl = card.querySelector('[data-card-title]');
      if (titleEl && item) titleEl.textContent = getTitle(item);
    }
  }

  // Un solo listener de clic por contenedor (delegado) — igual patrón que el
  // resto de las listas (bindProjectsList(), etc.), no uno por fila.
  // getTitle (opcional): recalcula el texto de [data-card-title] en la
  // cabecera al plegar/desplegar, para poder identificar una tarjeta cerrada
  // sin tener que abrirla (punto 9 — antes Experiencia/Educación se veían
  // como una barra vacía sin ninguna pista de cuál era cuál).
  //
  // Cada tarjeta se abre/cierra de forma independiente — no es un acordeón
  // de "una sola a la vez" que cierra las demás solo. Eso fue explícitamente
  // lo que pidió el admin (poder tener varias abiertas para comparar/editar
  // a la vez) y de paso evita el escenario que disparaba el bug de
  // superposición: dos tarjetas animando su colapso/apertura en el mismo
  // clic, una de las cuales podía terminar en un estado a medio limpiar.
  function bindAccordion(container, cardSelector, getList, getTitle) {
    container.addEventListener('click', function (e) {
      var toggleBtn = e.target.closest('[data-toggle-collapse]');
      if (!toggleBtn) return;
      var card = toggleBtn.closest(cardSelector);
      if (!card) return;
      var list = getList();
      var idx = Number(card.dataset.index);
      list[idx]._open = !list[idx]._open;
      applyAccordionState(card, list[idx], getTitle);
    });
  }

  // Entrada de "chips" para listas cortas (tecnologías, métricas): el
  // visitante del dashboard escribe texto normal — comas, Enter o pegar una
  // lista completa — y admin-chip-input.js la convierte en etiquetas,
  // dedupe y normaliza. El <input type="hidden"> sigue guardando el mismo
  // "a, b, c" que ya esperaba el resto del código (data-field sin cambios).
  function chipInputHtml(field, value, placeholder) {
    return '' +
      '<div class="chip-input" data-chip-input>' +
        '<input type="hidden" data-field="' + field + '" data-chip-hidden value="' + escapeAttr(value) + '">' +
        '<div class="chip-list" data-chip-list></div>' +
        '<input class="chip-input__text" type="text" data-chip-text placeholder="' + escapeAttr(placeholder) + '">' +
      '</div>';
  }

  // Campos con versión ES/EN por tipo de entidad. Todo lo que no aparece
  // aquí (título, URLs, tecnologías, fechas, valores numéricos, nombre de
  // cada skill) es el mismo en ambos modos de edición.
  var PROJECT_TRANSLATABLE = {
    what: 'whatEn', mine: 'mineEn', impact: 'impactEn', problem: 'problemEn',
    decision: 'decisionEn', result: 'resultEn',
    stat1Label: 'stat1LabelEn', stat2Label: 'stat2LabelEn', stat3Label: 'stat3LabelEn',
  };
  var SKILL_CAT_TRANSLATABLE = { name: 'nameEn' };
  var SKILL_ITEM_TRANSLATABLE = { level: 'levelEn' };
  var EXPERIENCE_TRANSLATABLE = {
    role: 'roleEn', org: 'orgEn', bulletsStr: 'bulletsEnStr', metricsStr: 'metricsEnStr',
  };
  var EDU_ENTRY_TRANSLATABLE = { degree: 'degreeEn', org: 'orgEn', status: 'statusEn' };
  var CERT_TRANSLATABLE = { name: 'nameEn', issuer: 'issuerEn' };
  var CONTACT_TRANSLATABLE = { label: 'labelEn' };
  var HERO_FACT_TRANSLATABLE = { label: 'labelEn', value: 'valueEn' };
  var BUTTON_TRANSLATABLE = { label: 'labelEn' };

  function isEditingEn() {
    return window.MPVAdmin.editLang === 'en';
  }

  // Dado un mapa {campoEs: campoEn} y el nombre "base" del campo (siempre el
  // de español), devuelve la propiedad real a leer/escribir según el modo.
  function activeField(map, field) {
    return (isEditingEn() && map[field]) ? map[field] : field;
  }

  function translatableLabel(map, field) {
    if (!map[field]) return '';
    var t = window.MPVAdminI18n ? window.MPVAdminI18n.t : function (k) { return k; };
    return ' <span class="translatable-badge" tabindex="0" title="' + escapeAttr(t('admin.translatableTooltip')) + '">' + escapeHtml(t('admin.translatable')) + '</span>';
  }

  function enPlaceholder(map, field) {
    return (isEditingEn() && map[field]) ? ' placeholder="(sin traducir todavía)"' : '';
  }

  /* ---------- simple [data-bind] fields (hero, contact, education, cv) ---------- */

  function applySimpleFieldsLang() {
    document.querySelectorAll('[data-bind]').forEach(function (el) {
      var esPath = el.getAttribute('data-bind');
      var enPath = el.getAttribute('data-bind-en');
      var path = (isEditingEn() && enPath) ? enPath : esPath;
      el.dataset.activePath = path;
      var val = getByPath(state, path);
      el.value = val == null ? '' : val;
      el.placeholder = (isEditingEn() && enPath) ? '(sin traducir todavía)' : '';
    });
  }

  function bindSimpleFields() {
    applySimpleFieldsLang();
    document.querySelectorAll('[data-bind]').forEach(function (el) {
      el.addEventListener('input', function () {
        setByPath(state, el.dataset.activePath, el.value);
        notifyChange();
      });
    });
  }

  /* ---------- FICHA RÁPIDA (dentro de Inicio) ---------- */

  function heroFactRowHtml(fact, i) {
    var f = function (field) { return activeField(HERO_FACT_TRANSLATABLE, field); };
    return '' +
      '<div class="mini-row" data-hero-fact-row data-index="' + i + '">' +
        GRIP_HANDLE_HTML +
        '<input class="input" type="text" data-field="label" aria-label="' + escapeAttr(t('admin.forms.dataLabel')) + '" placeholder="' + escapeAttr(t('admin.forms.dataLabel')) + enSuffix() + '" value="' + escapeAttr(fact[f('label')]) + '">' +
        '<input class="input" type="text" data-field="value" aria-label="' + escapeAttr(t('admin.forms.value')) + '" placeholder="' + escapeAttr(t('admin.forms.value')) + enSuffix() + '" value="' + escapeAttr(fact[f('value')]) + '">' +
        '<button type="button" class="mini-remove" data-action="remove-hero-fact">✕</button>' +
      '</div>';
  }

  function renderHeroFacts() {
    var container = document.querySelector('[data-hero-facts-list]');
    if (!container) return;
    container.innerHTML = '<div class="mini-row-list">' + state.heroFacts.map(heroFactRowHtml).join('') + '</div>';
  }

  function bindHeroFactsList() {
    var container = document.querySelector('[data-hero-facts-list]');
    if (!container) return;

    container.addEventListener('input', function (e) {
      var row = e.target.closest('[data-hero-fact-row]');
      if (!row || !e.target.dataset.field) return;
      var i = Number(row.dataset.index);
      var field = activeField(HERO_FACT_TRANSLATABLE, e.target.dataset.field);
      state.heroFacts[i][field] = e.target.value;
      notifyChange();
    });

    container.addEventListener('click', async function (e) {
      if (e.target.dataset.action !== 'remove-hero-fact') return;
      var row = e.target.closest('[data-hero-fact-row]');
      var i = Number(row.dataset.index);
      var label = (state.heroFacts[i].label || '').trim() || t('admin.forms.untitled');
      if (!(await confirmRemoval('admin.forms.kindFact', label))) return;
      await window.MPVAdmin.dustDisintegrate(row);
      state.heroFacts.splice(i, 1);
      renderHeroFacts();
      notifyChange();
    });

    var addBtn = document.querySelector('[data-add-hero-fact]');
    if (addBtn) addBtn.addEventListener('click', function () {
      state.heroFacts.push({ label: '', labelEn: '', value: '', valueEn: '' });
      renderHeroFacts();
      notifyChange();
    });

    window.MPVSortable.attach(container, '[data-hero-fact-row]', function () { return state.heroFacts; }, renderHeroFacts);
  }

  /* ---------- PROYECTOS ---------- */

  function statFieldsHtml(p) {
    return ['1', '2', '3'].map(function (n) {
      var labelField = 'stat' + n + 'Label';
      var activeLabel = activeField(PROJECT_TRANSLATABLE, labelField);
      return '' +
        '<div class="field-group">' +
          '<div class="field"><label>' + escapeHtml(t('admin.forms.value')) + ' ' + n + '</label><input class="input" type="text" data-field="stat' + n + 'Value" value="' + escapeAttr(p['stat' + n + 'Value']) + '"></div>' +
          '<div class="field"><label>' + escapeHtml(t('admin.forms.statLabelPrefix')) + ' ' + n + translatableLabel(PROJECT_TRANSLATABLE, labelField) + '</label><input class="input" type="text" data-field="' + labelField + '"' + enPlaceholder(PROJECT_TRANSLATABLE, labelField) + ' value="' + escapeAttr(p[activeLabel]) + '"></div>' +
        '</div>';
    }).join('');
  }

  // El proyecto insignia siempre se pinta primero y sin manija de arrastre
  // — ver pinFlagshipFirst() en renderProjects(). Sin GRIP_HANDLE_HTML no
  // hay ningún [data-drag-handle] dentro de esa fila, así que attachSortable
  // (ver admin-sortable.js) nunca puede iniciar un arrastre sobre ella.
  //
  // Orden de campos: "Tecnologías" va justo después de Título/Etiqueta (no
  // al final, después de Qué hace/Mi aporte/Impacto) porque así es como se
  // ve realmente en la vista previa — los chips de stack se renderizan justo
  // debajo del título en el proyecto insignia (public/index.php) y antes de
  // ese cambio el orden de edición no coincidía con el orden visual.
  // Un botón por fila (texto, URL, estilo Principal/Secundario) — cantidad
  // libre, reemplaza los 2 campos fijos "URL demo / URL GitHub" de antes
  // (punto 13). Principal/Secundario mapean 1:1 a las clases btn-accent/
  // btn-outline que ya existía el sitio público, solo se desacoplan de estar
  // fijas a "Demo"/"Código" — ver render en public/index.php.
  function buttonRowHtml(btn, pi, bi) {
    var labelField = activeField(BUTTON_TRANSLATABLE, 'label');
    return '' +
      '<div class="mini-row mini-row--button" data-btn-row data-btn-index="' + bi + '" data-index="' + bi + '">' +
        GRIP_HANDLE_HTML +
        '<input class="input" type="text" data-btn-field="label" aria-label="' + escapeAttr(t('admin.forms.buttonLabelPlaceholder')) + '" placeholder="' + escapeAttr(t('admin.forms.buttonLabelPlaceholder')) + enSuffix() + '" value="' + escapeAttr(btn[labelField]) + '">' +
        '<input class="input" type="text" data-btn-field="url" aria-label="' + escapeAttr(t('admin.forms.buttonUrlPlaceholder')) + '" placeholder="' + escapeAttr(t('admin.forms.buttonUrlPlaceholder')) + '" value="' + escapeAttr(btn.url) + '">' +
        '<select class="input select" data-btn-field="style" aria-label="' + escapeAttr(t('admin.forms.buttonStylePrimary')) + '/' + escapeAttr(t('admin.forms.buttonStyleSecondary')) + '">' +
          '<option value="primary"' + (btn.style === 'primary' ? ' selected' : '') + '>' + escapeHtml(t('admin.forms.buttonStylePrimary')) + '</option>' +
          '<option value="secondary"' + (btn.style !== 'primary' ? ' selected' : '') + '>' + escapeHtml(t('admin.forms.buttonStyleSecondary')) + '</option>' +
        '</select>' +
        '<button type="button" class="mini-remove" data-action="remove-button">✕</button>' +
      '</div>';
  }

  function projectRowHtml(p, i) {
    var bg = p.image ? ' style="background-image:url(\'../public/uploads/projects/' + escapeAttr(p.image) + '\')"' : '';
    var label = p.image ? '' : '<span class="image-drop-zone__label">' + escapeHtml(t('admin.forms.imageDropLabel')) + '</span>';
    var f = function (field) { return activeField(PROJECT_TRANSLATABLE, field); };
    var tl = function (field) { return translatableLabel(PROJECT_TRANSLATABLE, field); };
    var ph = function (field) { return enPlaceholder(PROJECT_TRANSLATABLE, field); };
    var buttonsHtml = (p.buttons || []).map(function (btn, bi) { return buttonRowHtml(btn, i, bi); }).join('');
    return '' +
      '<div class="repeat-card' + (p.flagship ? ' repeat-card--flagship' : '') + (p._open ? '' : ' is-collapsed') + '" data-project-row data-index="' + i + '">' +
        '<div class="repeat-card__head">' +
          '<div style="display:flex; align-items:center; gap:8px;">' +
            accordionToggleHtml(!!p._open) +
            (p.flagship ? '' : GRIP_HANDLE_HTML) +
            '<span class="repeat-card__head-label">' + (p.flagship ? escapeHtml(t('admin.forms.flagshipBadge')) : escapeHtml(t('admin.forms.projectLabel')) + ' ' + (i + 1)) + '</span>' +
            '<span class="repeat-card__title-preview" role="heading" aria-level="3" data-card-title>' + escapeHtml(p.title || t('admin.forms.untitled')) + '</span>' +
          '</div>' +
          '<div class="repeat-card__head-actions">' +
            checkboxToggleHtml('flagship', !!p.flagship, t('admin.forms.flagshipCheckbox')) +
            '<button type="button" class="remove-btn" data-action="remove-project">' + escapeHtml(t('admin.forms.removeBtn')) + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="repeat-card__body">' +
          '<div class="image-drop-zone" data-project-image-zone data-index="' + i + '" role="button" tabindex="0" aria-label="' + escapeAttr(t('admin.forms.imageDropLabel')) + '"' + bg + '>' + label +
            '<input type="file" accept="image/png,image/jpeg,image/webp" data-project-image-input>' +
          '</div>' +
          '<div class="form-grid">' +
            '<div class="field"><label>' + escapeHtml(t('admin.forms.titleLabel')) + '</label><input class="input" type="text" data-field="title" aria-label="' + escapeAttr(t('admin.forms.titleLabel')) + '" value="' + escapeAttr(p.title) + '"></div>' +
            '<div class="field"><label>' + escapeHtml(t('admin.forms.tagLabel')) + '</label><input class="input" type="text" data-field="tag" aria-label="' + escapeAttr(t('admin.forms.tagLabel')) + '" value="' + escapeAttr(p.tag) + '"></div>' +
          '</div>' +
          '<div class="field"><label>' + escapeHtml(t('admin.forms.techLabel')) + '</label>' + chipInputHtml('stackStr', p.stackStr, t('admin.forms.techPlaceholder')) + '</div>' +
          '<div class="field"><label>' + escapeHtml(t('admin.forms.whatLabel')) + tl('what') + '</label><textarea class="input" rows="2" data-field="what" aria-label="' + escapeAttr(t('admin.forms.whatLabel')) + '"' + ph('what') + '>' + escapeHtml(p[f('what')]) + '</textarea></div>' +
          '<div class="field"><label>' + escapeHtml(t('admin.forms.mineLabel')) + tl('mine') + '</label><textarea class="input" rows="2" data-field="mine" aria-label="' + escapeAttr(t('admin.forms.mineLabel')) + '"' + ph('mine') + '>' + escapeHtml(p[f('mine')]) + '</textarea></div>' +
          '<div class="field"><label>' + escapeHtml(t('admin.forms.impactLabel')) + tl('impact') + '</label><input class="input" type="text" data-field="impact" aria-label="' + escapeAttr(t('admin.forms.impactLabel')) + '"' + ph('impact') + ' value="' + escapeAttr(p[f('impact')]) + '"></div>' +
          '<div class="field">' +
            '<label>' + escapeHtml(t('admin.forms.buttonsLabel')) + '</label>' +
            '<p class="hint-text" style="margin:0 0 6px;">' + escapeHtml(t('admin.forms.buttonsHint')) + '</p>' +
            '<div class="mini-row-list" data-project-buttons>' + buttonsHtml + '</div>' +
            '<button type="button" class="add-link" data-action="add-button">' + escapeHtml(t('admin.forms.addButton')) + '</button>' +
          '</div>' +
          '<div class="flagship-fields" data-flagship-fields' + (p.flagship ? '' : ' hidden') + '>' +
            '<div class="field"><label>' + escapeHtml(t('admin.forms.problemLabel')) + tl('problem') + '</label><textarea class="input" rows="2" data-field="problem" aria-label="' + escapeAttr(t('admin.forms.problemLabel')) + '"' + ph('problem') + '>' + escapeHtml(p[f('problem')]) + '</textarea></div>' +
            '<div class="field"><label>' + escapeHtml(t('admin.forms.decisionLabel')) + tl('decision') + '</label><textarea class="input" rows="2" data-field="decision" aria-label="' + escapeAttr(t('admin.forms.decisionLabel')) + '"' + ph('decision') + '>' + escapeHtml(p[f('decision')]) + '</textarea></div>' +
            '<div class="field"><label>' + escapeHtml(t('admin.forms.resultLabel')) + tl('result') + '</label><textarea class="input" rows="2" data-field="result" aria-label="' + escapeAttr(t('admin.forms.resultLabel')) + '"' + ph('result') + '>' + escapeHtml(p[f('result')]) + '</textarea></div>' +
            '<div class="stats-grid">' + statFieldsHtml(p) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  // Garantiza "el insignia siempre arriba": si el arrastre (u otra
  // mutación) dejó el proyecto insignia en cualquier posición que no sea la
  // primera, lo regresa ahí antes de dibujar. Como solo los proyectos NO
  // insignia son draggable, esto nunca deshace un reordenamiento legítimo
  // entre ellos — solo corrige la posición del insignia mismo.
  function pinFlagshipFirst() {
    var idx = state.projects.findIndex(function (p) { return p.flagship; });
    if (idx > 0) {
      var flagship = state.projects.splice(idx, 1)[0];
      state.projects.unshift(flagship);
    }
  }

  function renderProjects() {
    pinFlagshipFirst();
    var container = document.querySelector('[data-projects-list]');
    container.innerHTML = state.projects.map(projectRowHtml).join('');
    if (window.MPVAdminUpload) window.MPVAdminUpload.bindProjectZones();
    window.MPVChipInput.enhance(container);
    // Una instancia de sortable por proyecto — los botones de un proyecto
    // solo se reordenan entre sí, nunca cruzan a otro proyecto (mismo
    // criterio que las habilidades por categoría, ver renderSkills()).
    container.querySelectorAll('[data-project-row]').forEach(function (row) {
      var pi = Number(row.dataset.index);
      var btnsContainer = row.querySelector('[data-project-buttons]');
      if (!btnsContainer) return;
      window.MPVSortable.attach(btnsContainer, '[data-btn-row]', function () { return state.projects[pi].buttons; }, renderProjects);
    });
  }

  function bindProjectsList() {
    var container = document.querySelector('[data-projects-list]');

    container.addEventListener('input', function (e) {
      if (e.target.type === 'checkbox') return;
      var row = e.target.closest('[data-project-row]');
      if (!row) return;
      var i = Number(row.dataset.index);
      var btnRow = e.target.closest('[data-btn-row]');
      if (btnRow && e.target.dataset.btnField) {
        var bi = Number(btnRow.dataset.btnIndex);
        var btnField = e.target.dataset.btnField === 'label' ? activeField(BUTTON_TRANSLATABLE, 'label') : e.target.dataset.btnField;
        state.projects[i].buttons[bi][btnField] = e.target.value;
        notifyChange();
        return;
      }
      if (!e.target.dataset.field) return;
      var field = activeField(PROJECT_TRANSLATABLE, e.target.dataset.field);
      state.projects[i][field] = e.target.value;
      notifyChange();
    });

    container.addEventListener('change', function (e) {
      var btnRow = e.target.closest('[data-btn-row]');
      if (btnRow && e.target.dataset.btnField === 'style') {
        var btnProjectRow = e.target.closest('[data-project-row]');
        var pi = Number(btnProjectRow.dataset.index);
        var bi2 = Number(btnRow.dataset.btnIndex);
        state.projects[pi].buttons[bi2].style = e.target.value;
        notifyChange();
        return;
      }
      if (e.target.dataset.field !== 'flagship') return;
      var row = e.target.closest('[data-project-row]');
      var i = Number(row.dataset.index);
      if (e.target.checked) {
        var alreadyFlagshipIdx = state.projects.findIndex(function (p, idx) { return p.flagship && idx !== i; });
        if (alreadyFlagshipIdx !== -1) {
          e.target.checked = false;
          row.classList.remove('is-shaking');
          // Forzar reflow para poder re-disparar la animación si se intenta de nuevo seguido.
          void row.offsetWidth;
          row.classList.add('is-shaking');
          setTimeout(function () { row.classList.remove('is-shaking'); }, 420);
          window.MPVAdmin.showToast && window.MPVAdmin.showToast(t('admin.forms.flagshipConflictToast'), true, 'center');
          return;
        }
      }
      state.projects[i].flagship = e.target.checked;
      renderProjects();
      notifyChange();
    });

    container.addEventListener('click', async function (e) {
      var action = e.target.dataset.action;
      if (action === 'remove-project') {
        var row = e.target.closest('[data-project-row]');
        var i = Number(row.dataset.index);
        if (!(await confirmRemoval('admin.forms.kindProject', state.projects[i].title))) return;
        await window.MPVAdmin.dustDisintegrate(row);
        state.projects.splice(i, 1);
        renderProjects();
        notifyChange();
        return;
      }
      if (action === 'add-button') {
        var projRow = e.target.closest('[data-project-row]');
        var pi = Number(projRow.dataset.index);
        state.projects[pi].buttons.push({ label: '', labelEn: '', url: '', style: 'secondary' });
        renderProjects();
        notifyChange();
        return;
      }
      if (action === 'remove-button') {
        var btnProjRow = e.target.closest('[data-project-row]');
        var btnPi = Number(btnProjRow.dataset.index);
        var btnRow = e.target.closest('[data-btn-row]');
        var bi = Number(btnRow.dataset.btnIndex);
        var btnLabel = (state.projects[btnPi].buttons[bi].label || '').trim() || t('admin.forms.untitled');
        if (!(await confirmRemoval('admin.forms.kindButton', btnLabel))) return;
        await window.MPVAdmin.dustDisintegrate(btnRow);
        state.projects[btnPi].buttons.splice(bi, 1);
        renderProjects();
        notifyChange();
      }
    });

    document.querySelector('[data-add-project]').addEventListener('click', function () {
      state.projects.push({
        flagship: false, title: '', tag: '', what: '', whatEn: '', mine: '', mineEn: '',
        impact: '', impactEn: '', stackStr: '', buttons: [], image: null,
        problem: '', problemEn: '', decision: '', decisionEn: '', result: '', resultEn: '',
        stat1Value: '', stat1Label: '', stat1LabelEn: '',
        stat2Value: '', stat2Label: '', stat2LabelEn: '',
        stat3Value: '', stat3Label: '', stat3LabelEn: '',
        _open: true,
      });
      renderProjects();
      notifyChange();
    });

    // excludeSelector: mismo motivo que en Habilidades — sin esto, arrastrar
    // un BOTÓN dentro de un proyecto también reordenaría el proyecto entero.
    window.MPVSortable.attach(container, '[data-project-row]', function () { return state.projects; }, renderProjects, '[data-btn-row]');
    bindAccordion(container, '[data-project-row]', function () { return state.projects; }, function (p) { return p.title || t('admin.forms.untitled'); });
  }

  /* ---------- HABILIDADES ---------- */

  // Niveles comunes, cada uno con un color distinto (ver skill_level_pill_class()
  // en src/helpers.php, misma progresión): Básico=ámbar, Intermedio=azul,
  // Avanzado=verde — una progresión de madurez clara en vez de que dos
  // niveles distintos compartan el mismo color — y Herramienta/Sistema (que
  // no son un nivel sino una etiqueta de categoría) en morado/turquesa para
  // no confundirse con la escala de progreso. Sugerencias vía el combo de
  // admin-combo.js, no una lista cerrada: el campo sigue siendo texto libre
  // para cualquier nivel personalizado (punto 12).
  // Los niveles de habilidad ya no son 5 presets fijos por código: son datos
  // (state.skillLevels, ver Portfolio::getAll()/saveAll()) que el admin
  // gestiona igual que cualquier otra lista — agregar, eliminar, recolorear.
  // La primera vez que se elige un color para un texto de nivel que todavía
  // no está en la lista, se agrega solo (ver el listener de 'input' del
  // color picker, más abajo) — así queda como "color principal" recordado
  // para ese nombre, sin dejar de poder personalizar una habilidad puntual
  // con otro color propio después.
  //
  // Cada definición vive en UN solo idioma a la vez (label O labelEn, no
  // los dos) EXCEPTO los 5 presets originales (que sí traen ambos desde la
  // siembra inicial) — si el admin agrega un nivel mientras edita en
  // español, esa sugerencia solo aparece editando en español; si lo agrega
  // en inglés, solo en inglés. No hay traducción automática (decisión
  // explícita: sin depender de un servicio externo nuevo) — el selector de
  // sugerencias simplemente se filtra por el idioma de edición activo.
  function skillLevelField() {
    return isEditingEn() ? 'labelEn' : 'label';
  }
  function skillLevelDefinition(level) {
    var key = (level || '').trim().toLowerCase();
    if (!key) return null;
    var field = skillLevelField();
    var found = null;
    (state.skillLevels || []).some(function (lvl) {
      if ((lvl[field] || '').trim().toLowerCase() === key) { found = lvl; return true; }
      return false;
    });
    return found;
  }
  // Heurístico de respaldo (mismo criterio que el PHP, skill_level_pill_class())
  // para texto libre que todavía no tiene una definición guardada ni un color
  // propio en la habilidad — solo entra en juego mientras el admin no haya
  // elegido nada todavía. Solo reconoce palabras en español (siempre fue
  // así, ver src/helpers.php) — en inglés simplemente no matchea nada y cae
  // al gris neutro, igual que cualquier otro texto libre sin definición.
  function skillLevelPresetColor(level) {
    var def = skillLevelDefinition(level);
    if (def) return def.color;
    var l = (level || '').toLowerCase();
    if (l.indexOf('avanzado') !== -1) return '#3fb950';
    if (l.indexOf('intermedio') !== -1) return '#58a6ff';
    if (l.indexOf('básico') !== -1) return '#d29922';
    if (l.indexOf('herramienta') !== -1) return '#a371f7';
    if (l.indexOf('sistema') !== -1) return '#39c5cf';
    return '#8b949e';
  }
  // Todas las definiciones guardadas (state.skillLevels) aparecen primero —
  // solo las que existan en el idioma de edición ACTIVO (ver skillLevelField()) —,
  // detrás cualquier nivel que ya esté escrito en alguna habilidad en ese
  // mismo idioma pero todavía no tenga definición propia. Ambos grupos son
  // gestionables por completo (todas llevan ✕, sin distinción).
  function skillLevelOptionsHtml() {
    var seen = {};
    var entries = [];
    var field = skillLevelField();
    (state.skillLevels || []).forEach(function (lvl) {
      var label = (lvl[field] || '').trim();
      if (!label) return;
      seen[label.toLowerCase()] = true;
      entries.push({ label: label, color: lvl.color });
    });
    var itemField = activeField(SKILL_ITEM_TRANSLATABLE, 'level');
    (state.skills || []).forEach(function (cat) {
      (cat.items || []).forEach(function (item) {
        var lvl = (item[itemField] || '').trim();
        if (!lvl) return;
        var key = lvl.toLowerCase();
        if (seen[key]) return;
        seen[key] = true;
        entries.push({ label: lvl, color: skillLevelPresetColor(lvl) });
      });
    });
    // Todas llevan ✕ — con confirmación, porque borrarla le quita el color
    // guardado (si tenía) y marca como "hay que revisar" a TODAS las
    // habilidades que la tengan puesta, no solo a la fila desde la que se
    // abrió el menú (ver bindSkillsList()).
    return entries.map(function (e) {
      return '' +
        '<div class="combo__option combo__option--removable" data-combo-option="' + escapeAttr(e.label) + '" role="option" tabindex="0">' +
          '<span class="combo__option-dot" style="background:' + e.color + '"></span>' +
          '<span class="combo__option-label">' + escapeHtml(e.label) + '</span>' +
          '<button type="button" class="combo__option-delete" data-combo-option-delete="' + escapeAttr(e.label) + '" title="' + escapeAttr(t('admin.forms.forgetLevelBtn')) + '" aria-label="' + escapeAttr(t('admin.forms.forgetLevelBtn')) + '">✕</button>' +
        '</div>';
    }).join('');
  }

  // Si `level` ya tiene una definición guardada (state.skillLevels) EN EL
  // IDIOMA DE EDICIÓN ACTIVO, su color. Si no, null — sin esto, un nivel
  // libre recién escrito se vería gris en el sitio público mientras no se
  // le elija un color.
  function findRememberedCustomLevelColor(level) {
    var def = skillLevelDefinition(level);
    return def ? def.color : null;
  }

  // Usado por admin-save.js antes de guardar (ver window.MPVAdminForms más
  // abajo): una habilidad marcada needsReview (ver combo:delete-option) usa
  // un nivel que ya no existe en la lista — no basta con el aviso visual,
  // el admin puede no haberlo notado, así que esto bloquea el guardado por
  // completo hasta que se corrija, en vez de guardar un texto de nivel
  // "huérfano" en silencio. Devuelve la primera fila afectada (para llevar
  // ahí al admin) o null si no hay ninguna.
  function findNeedsReviewSkill() {
    for (var ci = 0; ci < state.skills.length; ci++) {
      var items = state.skills[ci].items || [];
      for (var si = 0; si < items.length; si++) {
        if (items[si].needsReview) {
          return { catIndex: ci, itemIndex: si, skillName: (items[si].name || '').trim() || t('admin.forms.untitled') };
        }
      }
    }
    return null;
  }

  function skillCategoryHtml(cat, ci) {
    var catField = activeField(SKILL_CAT_TRANSLATABLE, 'name');
    var items = cat.items.map(function (s, si) {
      var levelField = activeField(SKILL_ITEM_TRANSLATABLE, 'level');
      return '' +
        '<div class="mini-row mini-row--skill" data-item-index="' + si + '" data-index="' + si + '">' +
          GRIP_HANDLE_HTML +
          '<input class="input" type="text" data-field="name" aria-label="' + escapeAttr(t('admin.forms.skillNamePlaceholder')) + '" placeholder="' + escapeAttr(t('admin.forms.skillNamePlaceholder')) + '" value="' + escapeAttr(s.name) + '">' +
          '<div class="combo' + (s.needsReview ? ' combo--needs-review' : '') + '" data-combo>' +
            '<input class="input combo__input" type="text" role="combobox" aria-expanded="false" aria-haspopup="listbox" data-field="level" data-combo-input name="lvl_' + NO_AUTOFILL_SALT + '_' + ci + '_' + si + '" aria-label="' + escapeAttr(t('admin.forms.skillLevelPlaceholder')) + '" placeholder="' + escapeAttr(t('admin.forms.skillLevelPlaceholder')) + enSuffix() + '" value="' + escapeAttr(s[levelField]) + '" autocomplete="off">' +
            (s.needsReview ? '<span class="combo__warning" title="' + escapeAttr(t('admin.forms.levelNeedsReview')) + '" aria-label="' + escapeAttr(t('admin.forms.levelNeedsReview')) + '">' + window.MPVIcons.warning + '</span>' : '') +
            '<button type="button" class="combo__toggle" data-combo-toggle aria-expanded="false" aria-label="' + escapeAttr(t('admin.forms.skillLevelPlaceholder')) + '">' + window.MPVIcons.chevronDown + '</button>' +
            '<div class="combo__panel" data-combo-panel role="listbox" hidden>' + skillLevelOptionsHtml() + '</div>' +
          '</div>' +
          '<div class="color-swatch color-swatch--compact" data-color-picker="skills.' + ci + '.items.' + si + '.levelColor">' +
            '<button type="button" class="color-swatch__btn color-swatch__btn--dot-only" data-color-swatch title="' + escapeAttr(t('admin.color.customize')) + '" aria-label="' + escapeAttr(t('admin.color.customize')) + '"><span class="color-swatch__dot" data-color-dot></span></button>' +
            // El color por defecto sigue el nivel actual (mismo criterio que
            // skill_level_pill_class() en PHP) en vez de un verde fijo, para
            // que el punto ya se vea coherente con "Básico/Intermedio/..."
            // antes de que el admin personalice nada.
            '<input type="color" class="color-swatch__input" data-color-input data-default="' + skillLevelPresetColor(s.level || '') + '" tabindex="-1" aria-hidden="true">' +
            '<button type="button" class="color-swatch__reset" data-color-reset hidden title="' + escapeAttr(t('admin.color.reset')) + '" aria-label="' + escapeAttr(t('admin.color.reset')) + '">' + window.MPVIcons.revert + '</button>' +
          '</div>' +
          '<button type="button" class="mini-remove" data-action="remove-skill">✕</button>' +
        '</div>';
    }).join('');
    return '' +
      '<div class="repeat-card' + (cat._open ? '' : ' is-collapsed') + '" data-cat-row data-index="' + ci + '">' +
        '<div class="repeat-card__head">' +
          '<div class="skill-cat-name-group">' +
            accordionToggleHtml(!!cat._open) +
            GRIP_HANDLE_HTML +
            '<input class="input skill-cat-name-input" type="text" data-field="name"' + enPlaceholder(SKILL_CAT_TRANSLATABLE, 'name') + ' value="' + escapeAttr(cat[catField]) + '">' +
          '</div>' +
          '<button type="button" class="remove-btn" data-action="remove-category">' + escapeHtml(t('admin.forms.removeBtn')) + '</button>' +
        '</div>' +
        '<div class="repeat-card__body">' +
          '<p class="hint-text" style="margin:0 0 2px;">' + escapeHtml(t('admin.forms.skillCatHintPart1')) + translatableLabel(SKILL_CAT_TRANSLATABLE, 'name') + ' ' + escapeHtml(t('admin.forms.skillCatHintPart2')) + translatableLabel(SKILL_ITEM_TRANSLATABLE, 'level') + ' ' + escapeHtml(t('admin.forms.skillCatHintPart3')) + ' ' + escapeHtml(t('admin.forms.skillCatHintPart4')) + '</p>' +
          '<div class="skill-items">' + items + '</div>' +
          '<button type="button" class="add-link" data-action="add-skill">' + escapeHtml(t('admin.forms.addSkillItem')) + '</button>' +
        '</div>' +
      '</div>';
  }

  function renderSkills() {
    var container = document.querySelector('[data-skills-list]');
    container.innerHTML = state.skills.map(skillCategoryHtml).join('');
    if (window.MPVColorPicker) window.MPVColorPicker.enhance(container);
    if (window.MPVCombo) window.MPVCombo.enhance(container);
    // Una instancia de sortable por categoría (las habilidades de una
    // categoría solo se reordenan entre sí, nunca cruzan a otra categoría) —
    // se vuelve a atar en cada render porque el innerHTML de arriba destruye
    // los nodos anteriores.
    container.querySelectorAll('[data-cat-row]').forEach(function (catRow) {
      var ci = Number(catRow.dataset.index);
      var itemsContainer = catRow.querySelector('.skill-items');
      if (!itemsContainer) return;
      window.MPVSortable.attach(itemsContainer, '[data-item-index]', function () { return state.skills[ci].items; }, renderSkills);
    });
  }

  function bindSkillsList() {
    var container = document.querySelector('[data-skills-list]');

    container.addEventListener('input', function (e) {
      var catRow = e.target.closest('[data-cat-row]');
      if (!catRow || !e.target.dataset.field) return;
      var ci = Number(catRow.dataset.index);
      var itemRow = e.target.closest('[data-item-index]');
      if (itemRow) {
        var si = Number(itemRow.dataset.itemIndex);
        var field = activeField(SKILL_ITEM_TRANSLATABLE, e.target.dataset.field);
        state.skills[ci].items[si][field] = e.target.value;
        // Cambiar el nivel (texto nuevo o elegido del combo) resuelve por sí
        // solo el aviso de "revisar" que haya quedado de un nivel eliminado
        // — ya no aplica una vez que el admin lo tocó de nuevo. Se quita del
        // DOM a mano (sin esperar a un re-render completo de la lista, que
        // esta misma función evita a propósito mientras se escribe) porque
        // si no, el aviso se queda "pegado" visualmente aunque el estado ya
        // esté corregido, hasta el próximo render por otro motivo.
        if (e.target.dataset.field === 'level' && state.skills[ci].items[si].needsReview) {
          state.skills[ci].items[si].needsReview = false;
          var comboEl = itemRow.querySelector('[data-combo]');
          if (comboEl) comboEl.classList.remove('combo--needs-review');
          var warnEl = itemRow.querySelector('.combo__warning');
          if (warnEl) warnEl.remove();
        }
        // El punto del selector de color sugiere el tono del nivel elegido
        // (ver skillLevelPresetColor) — si el nivel cambia (p. ej. al elegir
        // una opción del combo) y el color sigue en automático, refresca esa
        // sugerencia sin esperar a un re-render completo de la lista.
        if (e.target.dataset.field === 'level' && !state.skills[ci].items[si].levelColor) {
          var colorInput = itemRow.querySelector('[data-color-input]');
          if (colorInput) {
            var currentLevel = state.skills[ci].items[si][field] || '';
            var remembered = findRememberedCustomLevelColor(currentLevel);
            if (remembered) {
              // No es un preset (esos el heurístico de PHP ya los reconoce
              // solo) — es un nivel propio que el admin ya usó con este color
              // antes, así que se guarda tal cual en vez de dejarlo como
              // simple sugerencia: si no se guarda aquí, el sitio público lo
              // mostraría gris al no reconocer el texto libre.
              state.skills[ci].items[si].levelColor = remembered;
              colorInput.dataset.default = remembered;
            } else {
              colorInput.dataset.default = skillLevelPresetColor(currentLevel);
            }
            if (window.MPVColorPicker) window.MPVColorPicker.enhance(itemRow);
          }
        }
      } else {
        var catField = activeField(SKILL_CAT_TRANSLATABLE, e.target.dataset.field);
        state.skills[ci][catField] = e.target.value;
      }
      notifyChange();
    });

    // Primera vez que se elige un color para un texto de nivel que todavía
    // no tiene definición guardada EN EL IDIOMA QUE SE ESTÁ EDITANDO ahora:
    // se agrega sola a state.skillLevels como su "color principal" recordado
    // (ver skillLevelDefinition()) — elegido DESPUÉS de que
    // admin-color-picker.js ya guardó item.levelColor (ese listener está
    // atado directo al input, corre antes por el orden de burbujeo). Si el
    // nivel YA tenía definición, este color solo queda como personalización
    // de esta habilidad puntual, sin tocar la definición compartida — así
    // "la primera vez que elijo un color es el principal, pero puedo
    // personalizarlo por ocasiones específicas". La definición nueva se
    // guarda SOLO en el campo del idioma activo (label o labelEn, nunca los
    // dos) — sin traducción automática, ver skillLevelField().
    container.addEventListener('input', function (e) {
      if (!e.target.matches('[data-color-input]')) return;
      var itemRow = e.target.closest('[data-item-index]');
      if (!itemRow) return;
      var catRow = e.target.closest('[data-cat-row]');
      var ci = Number(catRow.dataset.index);
      var si = Number(itemRow.dataset.itemIndex);
      var item = state.skills[ci].items[si];
      var itemField = activeField(SKILL_ITEM_TRANSLATABLE, 'level');
      var levelText = (item[itemField] || '').trim();
      if (item.needsReview) {
        item.needsReview = false;
        var comboEl2 = itemRow.querySelector('[data-combo]');
        if (comboEl2) comboEl2.classList.remove('combo--needs-review');
        var warnEl2 = itemRow.querySelector('.combo__warning');
        if (warnEl2) warnEl2.remove();
      }
      if (!levelText || skillLevelDefinition(levelText)) return;
      state.skillLevels = state.skillLevels || [];
      var newDef = { label: null, labelEn: null, color: item.levelColor };
      newDef[skillLevelField()] = levelText;
      state.skillLevels.push(newDef);
    });

    container.addEventListener('click', async function (e) {
      var catRow = e.target.closest('[data-cat-row]');
      if (!catRow) return;
      var ci = Number(catRow.dataset.index);
      if (e.target.dataset.action === 'remove-category') {
        var catItemCount = state.skills[ci].items.length;
        var catWarning = catItemCount > 0 ? tf('admin.forms.confirmDeleteCategoryWarning', { COUNT: catItemCount }) : '';
        var catName = (state.skills[ci].name || '').trim() || t('admin.forms.untitled');
        var confirmed = await window.MPVAdmin.confirmDialog(
          tf('admin.forms.confirmDeleteCategoryMsg', { NAME: catName, WARNING: catWarning }),
          { title: t('admin.forms.confirmDeleteTitle'), confirmLabel: t('admin.confirmDialog.confirm') }
        );
        if (!confirmed) return;
        await window.MPVAdmin.dustDisintegrate(catRow);
        state.skills.splice(ci, 1);
        renderSkills();
        notifyChange();
      } else if (e.target.dataset.action === 'add-skill') {
        state.skills[ci].items.push({ name: '', level: '', levelEn: '', levelColor: '' });
        renderSkills();
        notifyChange();
      } else if (e.target.dataset.action === 'remove-skill') {
        var itemRow = e.target.closest('[data-item-index]');
        var si = Number(itemRow.dataset.itemIndex);
        var skillName = (state.skills[ci].items[si].name || '').trim() || t('admin.forms.untitled');
        if (!(await confirmRemoval('admin.forms.kindSkill', skillName))) return;
        await window.MPVAdmin.dustDisintegrate(itemRow);
        state.skills[ci].items.splice(si, 1);
        renderSkills();
        notifyChange();
      }
    });

    // La ✕ de "eliminar" un nivel (preset original o personalizado, ya no
    // hay distinción — ver skillLevelOptionsHtml()) — admin-combo.js no
    // decide nada, solo avisa con este evento; aquí sí se sabe qué
    // significa "eliminar": quitar la definición de state.skillLevels,
    // limpiar levelColor en CUALQUIER habilidad (de cualquier categoría)
    // que tenga ese mismo nivel puesto, y marcarla como "hay que revisar"
    // (needsReview) para que se note en la lista que ese texto ya no tiene
    // una definición válida detrás — sin este aviso, la habilidad se
    // quedaría con un texto de nivel "huérfano" sin que el admin lo note,
    // hasta que vaya a ver el sitio público. El texto del nivel en sí no se
    // toca, solo el color guardado.
    container.addEventListener('combo:delete-option', async function (e) {
      var label = e.detail && e.detail.label;
      if (!label) return;
      var key = label.trim().toLowerCase();
      var levelDefField = skillLevelField();
      var itemField = activeField(SKILL_ITEM_TRANSLATABLE, 'level');
      var affected = 0;
      state.skills.forEach(function (cat) {
        cat.items.forEach(function (item) {
          if ((item[itemField] || '').trim().toLowerCase() === key) affected++;
        });
      });
      var confirmed = await window.MPVAdmin.confirmDialog(
        tf('admin.forms.forgetLevelMsg', { NAME: label, COUNT: affected }),
        { title: t('admin.forms.confirmDeleteTitle'), confirmLabel: t('admin.confirmDialog.confirm') }
      );
      if (!confirmed) return;
      state.skillLevels = (state.skillLevels || []).filter(function (lvl) {
        return (lvl[levelDefField] || '').trim().toLowerCase() !== key;
      });
      state.skills.forEach(function (cat) {
        cat.items.forEach(function (item) {
          if ((item[itemField] || '').trim().toLowerCase() === key) {
            item.levelColor = '';
            item.needsReview = true;
          }
        });
      });
      renderSkills();
      notifyChange();
    });

    document.querySelector('[data-add-skill-category]').addEventListener('click', function () {
      state.skills.push({ name: '', nameEn: '', items: [], _open: true });
      renderSkills();
      notifyChange();
    });

    // excludeSelector: sin esto, arrastrar una HABILIDAD dentro de una
    // categoría (ver bindSkillItemsSortable() más abajo, atado por
    // categoría después de cada render) también reordenaría la CATEGORÍA
    // completa, porque el evento burbujea hasta este mismo contenedor — ver
    // el docblock de attachSortable() en admin-sortable.js.
    window.MPVSortable.attach(container, '[data-cat-row]', function () { return state.skills; }, renderSkills, '[data-item-index]');
    bindAccordion(container, '[data-cat-row]', function () { return state.skills; });
  }

  /* ---------- EXPERIENCIA ---------- */

  // dateRange/dateRangeEn ya no se escriben a mano (punto 6): se calculan al
  // vuelo aquí para la vista previa dentro del propio Dashboard, y de forma
  // autoritativa en el servidor al guardar (Portfolio::saveAll(), con
  // format_date_range() en src/helpers.php — misma lógica, misma duplicación
  // intencional JS/PHP que ya existe en otros lados de este proyecto).
  function experienceRowHtml(x, i) {
    var f = function (field) { return activeField(EXPERIENCE_TRANSLATABLE, field); };
    var tl = function (field) { return translatableLabel(EXPERIENCE_TRANSLATABLE, field); };
    var ph = function (field) { return enPlaceholder(EXPERIENCE_TRANSLATABLE, field); };
    var rangePreview = window.MPVDatepicker.formatDateRange(x.startDate, x.isCurrent ? null : x.endDate, 'es') || '—';
    return '' +
      '<div class="repeat-card' + (x._open ? '' : ' is-collapsed') + '" data-exp-row data-index="' + i + '">' +
        '<div class="repeat-card__head">' +
          accordionToggleHtml(!!x._open) +
          '<span class="repeat-card__title-preview" role="heading" aria-level="3" data-card-title>' + escapeHtml(joinTitleParts(x.role, x.org)) + '</span>' +
          '<button type="button" class="remove-btn" data-action="remove-exp">' + escapeHtml(t('admin.forms.removeBtn')) + '</button>' +
        '</div>' +
        '<div class="repeat-card__body">' +
          '<div class="field"><label>' + escapeHtml(t('admin.forms.roleLabel')) + tl('role') + '</label><input class="input" type="text" data-field="role" aria-label="' + escapeAttr(t('admin.forms.roleLabel')) + '"' + ph('role') + ' value="' + escapeAttr(x[f('role')]) + '"></div>' +
          '<div class="form-grid">' +
            '<div class="field"><label>' + escapeHtml(t('admin.forms.startDateLabel')) + '</label>' + window.MPVDatepicker.html('startDate', x.startDate) + '</div>' +
            '<div class="field" data-exp-end-field' + (x.isCurrent ? ' hidden' : '') + '><label>' + escapeHtml(t('admin.forms.endDateLabel')) + '</label>' + window.MPVDatepicker.html('endDate', x.endDate) + '</div>' +
          '</div>' +
          checkboxToggleHtml('isCurrent', !!x.isCurrent, t('admin.forms.currentJobLabel')) +
          '<p class="hint-text" data-exp-range-preview>' + escapeHtml(tf('admin.forms.rangePreview', { RANGE: rangePreview })) + '</p>' +
          '<div class="field"><label>' + escapeHtml(t('admin.forms.orgLabel')) + tl('org') + '</label><input class="input" type="text" data-field="org" aria-label="' + escapeAttr(t('admin.forms.orgLabel')) + '"' + ph('org') + ' value="' + escapeAttr(x[f('org')]) + '"></div>' +
          '<div class="field"><label>' + escapeHtml(t('admin.forms.bulletsLabel')) + tl('bulletsStr') + '</label><textarea class="input" rows="4" data-field="bulletsStr" aria-label="' + escapeAttr(t('admin.forms.bulletsLabel')) + '"' + ph('bulletsStr') + '>' + escapeHtml(x[f('bulletsStr')]) + '</textarea></div>' +
          '<div class="field"><label>' + escapeHtml(t('admin.forms.metricsLabel')) + tl('metricsStr') + '</label>' + chipInputHtml('metricsStr', x[f('metricsStr')], t('admin.forms.metricsPlaceholder')) + '</div>' +
        '</div>' +
      '</div>';
  }

  function renderExperience() {
    var container = document.querySelector('[data-experience-list]');
    container.innerHTML = state.experience.map(experienceRowHtml).join('');
    window.MPVChipInput.enhance(container);
    window.MPVDatepicker.enhance(container);
  }

  function updateExpRangePreview(row, x) {
    var preview = row.querySelector('[data-exp-range-preview]');
    if (!preview) return;
    var text = window.MPVDatepicker.formatDateRange(x.startDate, x.isCurrent ? null : x.endDate, 'es') || '—';
    preview.textContent = tf('admin.forms.rangePreview', { RANGE: text });
  }

  function bindExperienceList() {
    var container = document.querySelector('[data-experience-list]');

    container.addEventListener('input', function (e) {
      if (e.target.type === 'checkbox') return;
      var row = e.target.closest('[data-exp-row]');
      if (!row || !e.target.dataset.field) return;
      var i = Number(row.dataset.index);
      var field = activeField(EXPERIENCE_TRANSLATABLE, e.target.dataset.field);
      state.experience[i][field] = e.target.value;
      if (field === 'startDate' || field === 'endDate') {
        updateExpRangePreview(row, state.experience[i]);
        // El orden ya no es manual (ver compareByRecency arriba) — si la
        // fecha que se acaba de completar cambia el lugar que le toca, la
        // lista se vuelve a dibujar ya reordenada, igual que se verá en el
        // sitio público.
        if (resortIfChanged(state.experience, compareByRecency)) renderExperience();
      }
      notifyChange();
    });

    container.addEventListener('change', function (e) {
      if (e.target.dataset.field !== 'isCurrent') return;
      var row = e.target.closest('[data-exp-row]');
      var i = Number(row.dataset.index);
      // No se borra endDate del estado al marcar la casilla — solo se oculta
      // el campo. Así, si el admin la desmarca después, la fecha anterior
      // sigue ahí y la vista previa se actualiza al instante en vez de
      // quedarse en "Presente" hasta que se escriba una fecha nueva a mano.
      // endDate solo se manda vacío al servidor al guardar (ver
      // admin-save.js), no aquí.
      state.experience[i].isCurrent = e.target.checked;
      var endField = row.querySelector('[data-exp-end-field]');
      if (endField) endField.hidden = e.target.checked;
      updateExpRangePreview(row, state.experience[i]);
      if (resortIfChanged(state.experience, compareByRecency)) renderExperience();
      notifyChange();
    });

    container.addEventListener('click', async function (e) {
      if (e.target.dataset.action !== 'remove-exp') return;
      var row = e.target.closest('[data-exp-row]');
      var i = Number(row.dataset.index);
      var exp = state.experience[i];
      var expLabel = [exp.role, exp.org].filter(Boolean).join(' — ');
      if (!(await confirmRemoval('admin.forms.kindExperience', expLabel))) return;
      await window.MPVAdmin.dustDisintegrate(row);
      state.experience.splice(i, 1);
      renderExperience();
      notifyChange();
    });

    document.querySelector('[data-add-experience]').addEventListener('click', function () {
      state.experience.push({
        role: '', roleEn: '', org: '', orgEn: '', dateRange: '', dateRangeEn: '',
        startDate: '', endDate: '', isCurrent: false,
        bulletsStr: '', bulletsEnStr: '', metricsStr: '', metricsEnStr: '',
        _open: true,
      });
      renderExperience();
      notifyChange();
    });
    bindAccordion(container, '[data-exp-row]', function () { return state.experience; }, function (x) { return joinTitleParts(x.role, x.org); });
  }

  /* ---------- CERTIFICACIONES (dentro de Educación) ---------- */

  // Sin manija de arrastre: el orden ya no es manual, siempre va de la
  // certificación más reciente a la más antigua por issueDate (mismo
  // criterio que Portfolio::getAll() en PHP) — ver compareCertsByRecency.
  function certRowHtml(c, i) {
    var f = function (field) { return activeField(CERT_TRANSLATABLE, field); };
    return '' +
      '<div class="mini-row mini-row--dated" data-cert-row data-index="' + i + '">' +
        '<input class="input" type="text" data-field="name" aria-label="' + escapeAttr(t('admin.forms.courseNameLabel')) + '" placeholder="' + escapeAttr(t('admin.forms.courseNameLabel')) + enSuffix() + '" value="' + escapeAttr(c[f('name')]) + '">' +
        '<input class="input" type="text" data-field="issuer" aria-label="' + escapeAttr(t('admin.forms.institutionLabel')) + '" placeholder="' + escapeAttr(t('admin.forms.institutionLabel')) + enSuffix() + '" value="' + escapeAttr(c[f('issuer')]) + '">' +
        window.MPVDatepicker.html('issueDate', c.issueDate) +
        '<button type="button" class="mini-remove" data-action="remove-cert">✕</button>' +
      '</div>';
  }

  function renderCerts() {
    var container = document.querySelector('[data-certs-list]');
    container.innerHTML = '<div class="mini-row-list">' + state.certifications.map(certRowHtml).join('') + '</div>';
    window.MPVDatepicker.enhance(container);
  }

  function bindCertsList() {
    var container = document.querySelector('[data-certs-list]');

    container.addEventListener('input', function (e) {
      var row = e.target.closest('[data-cert-row]');
      if (!row || !e.target.dataset.field) return;
      var i = Number(row.dataset.index);
      var field = activeField(CERT_TRANSLATABLE, e.target.dataset.field);
      state.certifications[i][field] = e.target.value;
      if (field === 'issueDate' && resortIfChanged(state.certifications, compareCertsByRecency)) renderCerts();
      notifyChange();
    });

    container.addEventListener('click', async function (e) {
      if (e.target.dataset.action !== 'remove-cert') return;
      var row = e.target.closest('[data-cert-row]');
      var i = Number(row.dataset.index);
      if (!(await confirmRemoval('admin.forms.kindCert', state.certifications[i].name))) return;
      await window.MPVAdmin.dustDisintegrate(row);
      state.certifications.splice(i, 1);
      renderCerts();
      notifyChange();
    });

    document.querySelector('[data-add-cert]').addEventListener('click', function () {
      state.certifications.push({ name: '', nameEn: '', issuer: '', issuerEn: '', issueDate: '' });
      renderCerts();
      notifyChange();
    });
  }

  /* ---------- TÍTULOS/GRADOS (dentro de Educación) ---------- */

  // Mismo tratamiento que Experiencia (incluida la lista en sí, punto 9: el
  // admin puede agregar más de un título/grado) — fecha de inicio + fin (o
  // "actualmente estudiando") en vez de texto libre, y mismo cuidado con
  // isCurrent/endDate (punto 8: no se borra endDate del estado al marcar la
  // casilla, ver bindEducationEntriesList()).
  function eduEntryRowHtml(x, i) {
    var f = function (field) { return activeField(EDU_ENTRY_TRANSLATABLE, field); };
    var tl = function (field) { return translatableLabel(EDU_ENTRY_TRANSLATABLE, field); };
    var ph = function (field) { return enPlaceholder(EDU_ENTRY_TRANSLATABLE, field); };
    var rangePreview = window.MPVDatepicker.formatDateRange(x.startDate, x.isCurrent ? null : x.endDate, 'es') || '—';
    return '' +
      '<div class="repeat-card' + (x._open ? '' : ' is-collapsed') + '" data-edu-entry-row data-index="' + i + '">' +
        '<div class="repeat-card__head">' +
          accordionToggleHtml(!!x._open) +
          '<span class="repeat-card__title-preview" role="heading" aria-level="3" data-card-title>' + escapeHtml(joinTitleParts(x.degree, x.org)) + '</span>' +
          '<button type="button" class="remove-btn" data-action="remove-edu-entry">' + escapeHtml(t('admin.forms.removeBtn')) + '</button>' +
        '</div>' +
        '<div class="repeat-card__body">' +
          '<div class="field"><label>' + escapeHtml(t('admin.forms.degreeLabel')) + tl('degree') + '</label><input class="input" type="text" data-field="degree" aria-label="' + escapeAttr(t('admin.forms.degreeLabel')) + '"' + ph('degree') + ' value="' + escapeAttr(x[f('degree')]) + '"></div>' +
          '<div class="field"><label>' + escapeHtml(t('admin.forms.institutionLabel')) + tl('org') + '</label><input class="input" type="text" data-field="org" aria-label="' + escapeAttr(t('admin.forms.institutionLabel')) + '"' + ph('org') + ' value="' + escapeAttr(x[f('org')]) + '"></div>' +
          '<div class="form-grid">' +
            '<div class="field"><label>' + escapeHtml(t('admin.forms.startDateLabel')) + '</label>' + window.MPVDatepicker.html('startDate', x.startDate) + '</div>' +
            '<div class="field" data-edu-end-field' + (x.isCurrent ? ' hidden' : '') + '><label>' + escapeHtml(t('admin.forms.endDateLabel')) + '</label>' + window.MPVDatepicker.html('endDate', x.endDate) + '</div>' +
          '</div>' +
          checkboxToggleHtml('isCurrent', !!x.isCurrent, t('admin.forms.currentStudyLabel')) +
          '<p class="hint-text" data-edu-range-preview>' + escapeHtml(tf('admin.forms.rangePreview', { RANGE: rangePreview })) + '</p>' +
          '<div class="field"><label>' + escapeHtml(t('admin.forms.statusLabel')) + tl('status') + '</label><input class="input" type="text" data-field="status" aria-label="' + escapeAttr(t('admin.forms.statusLabel')) + '"' + ph('status') + ' value="' + escapeAttr(x[f('status')]) + '"></div>' +
        '</div>' +
      '</div>';
  }

  function renderEducationEntries() {
    var container = document.querySelector('[data-education-entries-list]');
    if (!container) return;
    container.innerHTML = state.educationEntries.map(eduEntryRowHtml).join('');
    window.MPVDatepicker.enhance(container);
  }

  function updateEduEntryRangePreview(row, x) {
    var preview = row.querySelector('[data-edu-range-preview]');
    if (!preview) return;
    var text = window.MPVDatepicker.formatDateRange(x.startDate, x.isCurrent ? null : x.endDate, 'es') || '—';
    preview.textContent = tf('admin.forms.rangePreview', { RANGE: text });
  }

  function bindEducationEntriesList() {
    var container = document.querySelector('[data-education-entries-list]');
    if (!container) return;

    container.addEventListener('input', function (e) {
      if (e.target.type === 'checkbox') return;
      var row = e.target.closest('[data-edu-entry-row]');
      if (!row || !e.target.dataset.field) return;
      var i = Number(row.dataset.index);
      var field = activeField(EDU_ENTRY_TRANSLATABLE, e.target.dataset.field);
      state.educationEntries[i][field] = e.target.value;
      if (field === 'startDate' || field === 'endDate') {
        updateEduEntryRangePreview(row, state.educationEntries[i]);
        if (resortIfChanged(state.educationEntries, compareByRecency)) renderEducationEntries();
      }
      notifyChange();
    });

    container.addEventListener('change', function (e) {
      if (e.target.dataset.field !== 'isCurrent') return;
      var row = e.target.closest('[data-edu-entry-row]');
      var i = Number(row.dataset.index);
      // Igual que Experiencia: no se borra endDate del estado al marcar la
      // casilla, solo se manda vacío al guardar (ver admin-save.js) — así
      // desmarcarla restaura la fecha anterior sin escribirla de nuevo.
      state.educationEntries[i].isCurrent = e.target.checked;
      var endField = row.querySelector('[data-edu-end-field]');
      if (endField) endField.hidden = e.target.checked;
      updateEduEntryRangePreview(row, state.educationEntries[i]);
      if (resortIfChanged(state.educationEntries, compareByRecency)) renderEducationEntries();
      notifyChange();
    });

    container.addEventListener('click', async function (e) {
      if (e.target.dataset.action !== 'remove-edu-entry') return;
      var row = e.target.closest('[data-edu-entry-row]');
      var i = Number(row.dataset.index);
      var label = (state.educationEntries[i].degree || '').trim() || t('admin.forms.untitled');
      if (!(await confirmRemoval('admin.forms.kindDegree', label))) return;
      await window.MPVAdmin.dustDisintegrate(row);
      state.educationEntries.splice(i, 1);
      renderEducationEntries();
      notifyChange();
    });

    var addBtn = document.querySelector('[data-add-education-entry]');
    if (addBtn) addBtn.addEventListener('click', function () {
      state.educationEntries.push({
        degree: '', degreeEn: '', org: '', orgEn: '', dateRange: '', dateRangeEn: '',
        startDate: '', endDate: '', isCurrent: false, status: '', statusEn: '',
        _open: true,
      });
      renderEducationEntries();
      notifyChange();
    });
    bindAccordion(container, '[data-edu-entry-row]', function () { return state.educationEntries; }, function (x) { return joinTitleParts(x.degree, x.org); });
  }

  /* ---------- IDIOMAS (dentro de Educación) ---------- */

  // Se sigue guardando como un string por línea "Idioma — descripción"
  // (mismo formato que ya consume public/index.php vía explode('—', ...))
  // — esto es solo una UI de agregar/quitar sobre ese mismo texto, no un
  // cambio de esquema. Antes era un <textarea> de edición manual.
  function splitLines(s) {
    return (s || '').split(/\r\n|\r|\n/).map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function joinLines(arr) {
    return (arr || []).join('\n');
  }
  function splitLangLine(line) {
    var idx = (line || '').indexOf('—');
    if (idx === -1) return { name: line || '', desc: '' };
    return { name: line.slice(0, idx).trim(), desc: line.slice(idx + 1).trim() };
  }
  function joinLangLine(name, desc) {
    name = (name || '').trim();
    desc = (desc || '').trim();
    return desc ? (name + ' — ' + desc) : name;
  }

  function languageRows() {
    var esLines = splitLines(state.education.languagesStr);
    var enLines = splitLines(state.education.languagesEnStr);
    var len = Math.max(esLines.length, enLines.length);
    var rows = [];
    for (var i = 0; i < len; i++) {
      rows.push({ es: esLines[i] || '', en: enLines[i] || '' });
    }
    return rows;
  }

  function writeLanguageRows(rows) {
    state.education.languagesStr = joinLines(rows.map(function (r) { return r.es; }));
    state.education.languagesEnStr = joinLines(rows.map(function (r) { return r.en; }));
  }

  function languageRowHtml(row, i) {
    var parts = splitLangLine(isEditingEn() ? row.en : row.es);
    return '' +
      '<div class="mini-row" data-lang-row data-index="' + i + '">' +
        GRIP_HANDLE_HTML +
        '<input class="input" type="text" data-field="name" aria-label="' + escapeAttr(t('admin.forms.languageLabel')) + '" placeholder="' + escapeAttr(t('admin.forms.languageLabel')) + enSuffix() + '" value="' + escapeAttr(parts.name) + '">' +
        '<input class="input" type="text" data-field="desc" aria-label="' + escapeAttr(t('admin.forms.descriptionLabel')) + '" placeholder="' + escapeAttr(t('admin.forms.descriptionLabel')) + enSuffix() + '" value="' + escapeAttr(parts.desc) + '">' +
        '<button type="button" class="mini-remove" data-action="remove-language">✕</button>' +
      '</div>';
  }

  function renderLanguages() {
    var container = document.querySelector('[data-languages-list]');
    if (!container) return;
    container.innerHTML = '<div class="mini-row-list">' + languageRows().map(languageRowHtml).join('') + '</div>';
  }

  function bindLanguagesList() {
    var container = document.querySelector('[data-languages-list]');
    if (!container) return;

    container.addEventListener('input', function (e) {
      var row = e.target.closest('[data-lang-row]');
      if (!row || !e.target.dataset.field) return;
      var i = Number(row.dataset.index);
      var rows = languageRows();
      if (!rows[i]) return;
      var current = splitLangLine(isEditingEn() ? rows[i].en : rows[i].es);
      if (e.target.dataset.field === 'name') current.name = e.target.value;
      else current.desc = e.target.value;
      var joined = joinLangLine(current.name, current.desc);
      if (isEditingEn()) rows[i].en = joined; else rows[i].es = joined;
      writeLanguageRows(rows);
      notifyChange();
    });

    container.addEventListener('click', async function (e) {
      if (e.target.dataset.action !== 'remove-language') return;
      var row = e.target.closest('[data-lang-row]');
      var i = Number(row.dataset.index);
      var rows = languageRows();
      var label = splitLangLine(rows[i].es).name || t('admin.forms.untitled');
      if (!(await confirmRemoval('admin.forms.kindLanguage', label))) return;
      await window.MPVAdmin.dustDisintegrate(row);
      rows.splice(i, 1);
      writeLanguageRows(rows);
      renderLanguages();
      notifyChange();
    });

    var addBtn = document.querySelector('[data-add-language]');
    if (addBtn) addBtn.addEventListener('click', function () {
      var rows = languageRows();
      rows.push({ es: '', en: '' });
      writeLanguageRows(rows);
      renderLanguages();
      notifyChange();
    });

    // Idiomas no vive como un array propio en el estado (se deriva de
    // education.languagesStr/languagesEnStr, ver languageRows() arriba) — el
    // arrastre necesita la MISMA referencia que mutó (splice) para poder
    // escribirla de regreso con writeLanguageRows() antes de volver a
    // dibujar, así que se guarda en un cierre en vez de recalcularla dos veces.
    var pendingLangRows = null;
    window.MPVSortable.attach(container, '[data-lang-row]', function () {
      pendingLangRows = languageRows();
      return pendingLangRows;
    }, function () {
      writeLanguageRows(pendingLangRows);
      renderLanguages();
    });
  }

  /* ---------- CONTACTO ---------- */

  function contactRowHtml(c, i) {
    var f = activeField(CONTACT_TRANSLATABLE, 'label');
    return '' +
      '<div class="mini-row" data-contact-row data-index="' + i + '">' +
        GRIP_HANDLE_HTML +
        '<input class="input" type="text" data-field="label" aria-label="' + escapeAttr(t('admin.forms.contactLabelPlaceholder')) + '" placeholder="' + escapeAttr(t('admin.forms.contactLabelPlaceholder')) + enSuffix() + '" value="' + escapeAttr(c[f]) + '">' +
        '<input class="input" type="text" data-field="value" aria-label="' + escapeAttr(t('admin.forms.value')) + '" placeholder="' + escapeAttr(t('admin.forms.value')) + '" value="' + escapeAttr(c.value) + '">' +
        '<button type="button" class="mini-remove" data-action="remove-contact">✕</button>' +
      '</div>';
  }

  function renderContacts() {
    var container = document.querySelector('[data-contacts-list]');
    if (!container) return;
    container.innerHTML = '<div class="mini-row-list">' + state.contact.items.map(contactRowHtml).join('') + '</div>';
  }

  function bindContactsList() {
    var container = document.querySelector('[data-contacts-list]');
    if (!container) return;

    container.addEventListener('input', function (e) {
      var row = e.target.closest('[data-contact-row]');
      if (!row || !e.target.dataset.field) return;
      var i = Number(row.dataset.index);
      if (e.target.dataset.field === 'label') {
        state.contact.items[i][activeField(CONTACT_TRANSLATABLE, 'label')] = e.target.value;
      } else {
        state.contact.items[i].value = e.target.value;
      }
      notifyChange();
    });

    container.addEventListener('click', async function (e) {
      if (e.target.dataset.action !== 'remove-contact') return;
      var row = e.target.closest('[data-contact-row]');
      var i = Number(row.dataset.index);
      var label = (state.contact.items[i].label || '').trim() || t('admin.forms.untitled');
      if (!(await confirmRemoval('admin.forms.kindContact', label))) return;
      await window.MPVAdmin.dustDisintegrate(row);
      state.contact.items.splice(i, 1);
      renderContacts();
      notifyChange();
    });

    var addBtn = document.querySelector('[data-add-contact]');
    if (addBtn) addBtn.addEventListener('click', function () {
      state.contact.items.push({ label: '', labelEn: '', value: '' });
      renderContacts();
      notifyChange();
    });

    window.MPVSortable.attach(container, '[data-contact-row]', function () { return state.contact.items; }, renderContacts);
  }

  /* ---------- modo de edición ES/EN ---------- */

  function rerenderAllForEditLang() {
    applySimpleFieldsLang();
    renderHeroFacts();
    renderProjects();
    renderSkills();
    renderExperience();
    renderEducationEntries();
    renderCerts();
    renderLanguages();
    renderContacts();
  }

  /**
   * Vuelve a dibujar todo el dashboard a partir del estado actual —lo usa
   * admin-draft.js después de restaurar un borrador guardado en
   * localStorage, ya que ese estado no llegó por el <script id="admin-data">
   * que normalmente inicializa cada render* al cargar la página.
   */
  function renderAll() {
    applySimpleFieldsLang();
    renderHeroFacts();
    renderProjects();
    renderSkills();
    renderExperience();
    renderEducationEntries();
    renderCerts();
    renderLanguages();
    renderContacts();
  }

  /* ---------- init ---------- */

  document.addEventListener('DOMContentLoaded', function () {
    state = window.MPVAdmin.state;
    utils = window.MPVAdmin.utils;
    getByPath = window.MPVAdmin.getByPath;
    setByPath = window.MPVAdmin.setByPath;
    notifyChange = window.MPVAdmin.notifyChange;

    bindSimpleFields();

    renderHeroFacts();
    bindHeroFactsList();

    ensureOneOpen(state.projects);
    renderProjects();
    bindProjectsList();

    ensureOneOpen(state.skills);
    renderSkills();
    bindSkillsList();

    ensureOneOpen(state.experience);
    renderExperience();
    bindExperienceList();

    ensureOneOpen(state.educationEntries);
    renderEducationEntries();
    bindEducationEntriesList();

    renderCerts();
    bindCertsList();

    renderLanguages();
    bindLanguagesList();

    renderContacts();
    bindContactsList();

    document.addEventListener('mpv-admin:editlangchange', rerenderAllForEditLang);
    // Cambiar el idioma de INTERFAZ del dashboard (mpv-admin:langchange, ver
    // admin-i18n.js) también debe redibujar estos paneles — son 100% HTML
    // generado por este archivo, así que sin esto solo se traducía Inicio
    // (que usa data-i18n estático en admin/index.php) y el resto del
    // dashboard se quedaba en español sin importar el idioma elegido.
    document.addEventListener('mpv-admin:langchange', rerenderAllForEditLang);
  });

  window.MPVAdminForms = { renderAll: renderAll, findNeedsReviewSkill: findNeedsReviewSkill };
})();
