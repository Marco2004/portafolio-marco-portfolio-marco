(function () {
  var state, utils, getByPath, setByPath, notifyChange;

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var escapeAttr = escapeHtml;

  // Confirmación específica antes de quitar un bloque completo de contenido
  // (proyecto, categoría, experiencia, certificación). Nombra el elemento
  // real en vez de un "¿Estás seguro?" genérico. El elemento no se borra en
  // el servidor hasta pulsar "Guardar cambios", pero quien edita no tiene
  // por qué saber ese detalle interno — debe sentir la acción como definitiva.
  // Usa el modal propio (admin-confirm-dialog.js) en vez de window.confirm()
  // — nativo, bloqueante y visualmente ajeno al resto del dashboard.
  function confirmRemoval(kind, label) {
    var name = (label || '').trim() || 'sin título';
    return window.MPVAdmin.confirmDialog(
      '¿Eliminar ' + kind + ' "' + name + '"? Se quitará del portafolio la próxima vez que guardes los cambios.',
      { title: 'Confirmar eliminación' }
    );
  }

  var GRIP_HANDLE_HTML = '<span class="drag-handle" data-drag-handle title="Arrastrar para reordenar" aria-hidden="true">' + window.MPVIcons.grip + '</span>';

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
        '<input class="input" type="text" data-field="label" placeholder="Dato (ej. Ubicación)' + (isEditingEn() ? ' (en inglés)' : '') + '" value="' + escapeAttr(fact[f('label')]) + '">' +
        '<input class="input" type="text" data-field="value" placeholder="Valor' + (isEditingEn() ? ' (en inglés)' : '') + '" value="' + escapeAttr(fact[f('value')]) + '">' +
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
      var label = (state.heroFacts[i].label || '').trim() || 'sin título';
      if (!(await confirmRemoval('el dato', label))) return;
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
  }

  /* ---------- PROYECTOS ---------- */

  function statFieldsHtml(p) {
    return ['1', '2', '3'].map(function (n) {
      var labelField = 'stat' + n + 'Label';
      var activeLabel = activeField(PROJECT_TRANSLATABLE, labelField);
      return '' +
        '<div class="field-group">' +
          '<div class="field"><label>Valor ' + n + '</label><input class="input" type="text" data-field="stat' + n + 'Value" value="' + escapeAttr(p['stat' + n + 'Value']) + '"></div>' +
          '<div class="field"><label>Etiqueta ' + n + translatableLabel(PROJECT_TRANSLATABLE, labelField) + '</label><input class="input" type="text" data-field="' + labelField + '"' + enPlaceholder(PROJECT_TRANSLATABLE, labelField) + ' value="' + escapeAttr(p[activeLabel]) + '"></div>' +
        '</div>';
    }).join('');
  }

  // El proyecto insignia siempre se pinta primero y sin manija de arrastre
  // — ver pinFlagshipFirst() en renderProjects(). Solo los demás proyectos
  // son draggable="true", así que attachSortable nunca puede iniciar (ni
  // recibir) un arrastre sobre la fila insignia.
  function projectRowHtml(p, i) {
    var bg = p.image ? ' style="background-image:url(\'../public/uploads/projects/' + escapeAttr(p.image) + '\')"' : '';
    var label = p.image ? '' : '<span class="image-drop-zone__label">Arrastra una captura o haz clic para elegir un archivo</span>';
    var f = function (field) { return activeField(PROJECT_TRANSLATABLE, field); };
    var tl = function (field) { return translatableLabel(PROJECT_TRANSLATABLE, field); };
    var ph = function (field) { return enPlaceholder(PROJECT_TRANSLATABLE, field); };
    return '' +
      '<div class="repeat-card' + (p.flagship ? ' repeat-card--flagship' : '') + '" data-project-row data-index="' + i + '"' + (p.flagship ? '' : ' draggable="true"') + '>' +
        '<div class="repeat-card__head">' +
          '<div style="display:flex; align-items:center; gap:8px;">' +
            (p.flagship ? '' : GRIP_HANDLE_HTML) +
            '<span class="repeat-card__head-label">' + (p.flagship ? '★ Insignia' : 'Proyecto ' + (i + 1)) + '</span>' +
          '</div>' +
          '<div class="repeat-card__head-actions">' +
            '<label class="checkbox-label"><input type="checkbox" data-field="flagship"' + (p.flagship ? ' checked' : '') + '> Insignia</label>' +
            '<button type="button" class="remove-btn" data-action="remove-project">Eliminar ✕</button>' +
          '</div>' +
        '</div>' +
        '<div class="repeat-card__body">' +
          '<div class="image-drop-zone" data-project-image-zone data-index="' + i + '"' + bg + '>' + label +
            '<input type="file" accept="image/png,image/jpeg,image/webp" data-project-image-input>' +
          '</div>' +
          '<div class="form-grid">' +
            '<div class="field"><label>Título</label><input class="input" type="text" data-field="title" value="' + escapeAttr(p.title) + '"></div>' +
            '<div class="field"><label>Etiqueta (ej. Freelance · 2024)</label><input class="input" type="text" data-field="tag" value="' + escapeAttr(p.tag) + '"></div>' +
          '</div>' +
          '<div class="field"><label>Qué hace' + tl('what') + '</label><textarea class="input" rows="2" data-field="what"' + ph('what') + '>' + escapeHtml(p[f('what')]) + '</textarea></div>' +
          '<div class="field"><label>Mi aporte' + tl('mine') + '</label><textarea class="input" rows="2" data-field="mine"' + ph('mine') + '>' + escapeHtml(p[f('mine')]) + '</textarea></div>' +
          '<div class="field"><label>Impacto / resultados' + tl('impact') + '</label><input class="input" type="text" data-field="impact"' + ph('impact') + ' value="' + escapeAttr(p[f('impact')]) + '"></div>' +
          '<div class="field"><label>Tecnologías</label>' + chipInputHtml('stackStr', p.stackStr, 'Escribe y presiona Enter, o pega una lista') + '</div>' +
          '<div class="form-grid">' +
            '<div class="field"><label>URL demo en vivo</label><input class="input" type="text" data-field="demoUrl" value="' + escapeAttr(p.demoUrl) + '"></div>' +
            '<div class="field"><label>URL de GitHub</label><input class="input" type="text" data-field="codeUrl" value="' + escapeAttr(p.codeUrl) + '"></div>' +
          '</div>' +
          '<div class="flagship-fields" data-flagship-fields' + (p.flagship ? '' : ' hidden') + '>' +
            '<div class="field"><label>Problema' + tl('problem') + '</label><textarea class="input" rows="2" data-field="problem"' + ph('problem') + '>' + escapeHtml(p[f('problem')]) + '</textarea></div>' +
            '<div class="field"><label>Decisión técnica' + tl('decision') + '</label><textarea class="input" rows="2" data-field="decision"' + ph('decision') + '>' + escapeHtml(p[f('decision')]) + '</textarea></div>' +
            '<div class="field"><label>Resultado' + tl('result') + '</label><textarea class="input" rows="2" data-field="result"' + ph('result') + '>' + escapeHtml(p[f('result')]) + '</textarea></div>' +
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
  }

  function bindProjectsList() {
    var container = document.querySelector('[data-projects-list]');

    container.addEventListener('input', function (e) {
      if (e.target.type === 'checkbox') return;
      var row = e.target.closest('[data-project-row]');
      if (!row || !e.target.dataset.field) return;
      var i = Number(row.dataset.index);
      var field = activeField(PROJECT_TRANSLATABLE, e.target.dataset.field);
      state.projects[i][field] = e.target.value;
      notifyChange();
    });

    container.addEventListener('change', function (e) {
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
          window.MPVAdmin.showToast && window.MPVAdmin.showToast('Ya existe un proyecto insignia — quítalo primero para elegir otro.', true, 'center');
          return;
        }
      }
      state.projects[i].flagship = e.target.checked;
      renderProjects();
      notifyChange();
    });

    container.addEventListener('click', async function (e) {
      if (e.target.dataset.action !== 'remove-project') return;
      var row = e.target.closest('[data-project-row]');
      var i = Number(row.dataset.index);
      if (!(await confirmRemoval('el proyecto', state.projects[i].title))) return;
      await window.MPVAdmin.dustDisintegrate(row);
      state.projects.splice(i, 1);
      renderProjects();
      notifyChange();
    });

    document.querySelector('[data-add-project]').addEventListener('click', function () {
      state.projects.push({
        flagship: false, title: '', tag: '', what: '', whatEn: '', mine: '', mineEn: '',
        impact: '', impactEn: '', stackStr: '', demoUrl: '', codeUrl: '', image: null,
        problem: '', problemEn: '', decision: '', decisionEn: '', result: '', resultEn: '',
        stat1Value: '', stat1Label: '', stat1LabelEn: '',
        stat2Value: '', stat2Label: '', stat2LabelEn: '',
        stat3Value: '', stat3Label: '', stat3LabelEn: '',
      });
      renderProjects();
      notifyChange();
    });

    window.MPVSortable.attach(container, '[data-project-row]', function () { return state.projects; }, renderProjects);
  }

  /* ---------- HABILIDADES ---------- */

  function skillCategoryHtml(cat, ci) {
    var catField = activeField(SKILL_CAT_TRANSLATABLE, 'name');
    var items = cat.items.map(function (s, si) {
      var levelField = activeField(SKILL_ITEM_TRANSLATABLE, 'level');
      return '' +
        '<div class="mini-row" data-item-index="' + si + '">' +
          '<input class="input" type="text" data-field="name" placeholder="Nombre" value="' + escapeAttr(s.name) + '">' +
          '<input class="input" type="text" data-field="level" placeholder="Nivel' + (isEditingEn() ? ' (en inglés)' : '') + '" value="' + escapeAttr(s[levelField]) + '">' +
          '<button type="button" class="mini-remove" data-action="remove-skill">✕</button>' +
        '</div>';
    }).join('');
    return '' +
      '<div class="repeat-card" data-cat-row data-index="' + ci + '" draggable="true">' +
        '<div class="repeat-card__head">' +
          '<div class="skill-cat-name-group">' +
            GRIP_HANDLE_HTML +
            '<input class="input skill-cat-name-input" type="text" data-field="name"' + enPlaceholder(SKILL_CAT_TRANSLATABLE, 'name') + ' value="' + escapeAttr(cat[catField]) + '">' +
          '</div>' +
          '<button type="button" class="remove-btn" data-action="remove-category">Eliminar ✕</button>' +
        '</div>' +
        '<div class="repeat-card__body">' +
          '<p class="hint-text" style="margin:0 0 2px;">Nombre de categoría' + translatableLabel(SKILL_CAT_TRANSLATABLE, 'name') + ' · nivel de cada habilidad' + translatableLabel(SKILL_ITEM_TRANSLATABLE, 'level') + ' · el nombre de la tecnología no se traduce</p>' +
          '<div class="skill-items">' + items + '</div>' +
          '<button type="button" class="add-link" data-action="add-skill">+ Agregar habilidad</button>' +
        '</div>' +
      '</div>';
  }

  function renderSkills() {
    var container = document.querySelector('[data-skills-list]');
    container.innerHTML = state.skills.map(skillCategoryHtml).join('');
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
      } else {
        var catField = activeField(SKILL_CAT_TRANSLATABLE, e.target.dataset.field);
        state.skills[ci][catField] = e.target.value;
      }
      notifyChange();
    });

    container.addEventListener('click', async function (e) {
      var catRow = e.target.closest('[data-cat-row]');
      if (!catRow) return;
      var ci = Number(catRow.dataset.index);
      if (e.target.dataset.action === 'remove-category') {
        var catItemCount = state.skills[ci].items.length;
        var catWarning = catItemCount > 0 ? ' junto con sus ' + catItemCount + ' habilidad(es)' : '';
        var catName = (state.skills[ci].name || 'sin título').trim();
        var confirmed = await window.MPVAdmin.confirmDialog(
          '¿Eliminar la categoría "' + catName + '"' + catWarning + '? Se quitará del portafolio la próxima vez que guardes los cambios.',
          { title: 'Confirmar eliminación' }
        );
        if (!confirmed) return;
        await window.MPVAdmin.dustDisintegrate(catRow);
        state.skills.splice(ci, 1);
        renderSkills();
        notifyChange();
      } else if (e.target.dataset.action === 'add-skill') {
        state.skills[ci].items.push({ name: '', level: '', levelEn: '' });
        renderSkills();
        notifyChange();
      } else if (e.target.dataset.action === 'remove-skill') {
        var itemRow = e.target.closest('[data-item-index]');
        var si = Number(itemRow.dataset.itemIndex);
        var skillName = (state.skills[ci].items[si].name || '').trim() || 'sin título';
        if (!(await confirmRemoval('la habilidad', skillName))) return;
        await window.MPVAdmin.dustDisintegrate(itemRow);
        state.skills[ci].items.splice(si, 1);
        renderSkills();
        notifyChange();
      }
    });

    document.querySelector('[data-add-skill-category]').addEventListener('click', function () {
      state.skills.push({ name: '', nameEn: '', items: [] });
      renderSkills();
      notifyChange();
    });

    window.MPVSortable.attach(container, '[data-cat-row]', function () { return state.skills; }, renderSkills);
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
      '<div class="repeat-card" data-exp-row data-index="' + i + '">' +
        '<div class="repeat-card__body">' +
          '<div style="display:flex; justify-content:flex-end; align-items:center;">' +
            '<button type="button" class="remove-btn" data-action="remove-exp">Eliminar ✕</button>' +
          '</div>' +
          '<div class="field"><label>Puesto' + tl('role') + '</label><input class="input" type="text" data-field="role"' + ph('role') + ' value="' + escapeAttr(x[f('role')]) + '"></div>' +
          '<div class="form-grid">' +
            '<div class="field"><label>Fecha de inicio</label>' + window.MPVDatepicker.html('startDate', x.startDate) + '</div>' +
            '<div class="field" data-exp-end-field' + (x.isCurrent ? ' hidden' : '') + '><label>Fecha de fin</label>' + window.MPVDatepicker.html('endDate', x.endDate) + '</div>' +
          '</div>' +
          '<label class="checkbox-label"><input type="checkbox" data-field="isCurrent"' + (x.isCurrent ? ' checked' : '') + '> Actualmente trabajo aquí</label>' +
          '<p class="hint-text" data-exp-range-preview>Se mostrará como: "' + escapeHtml(rangePreview) + '"</p>' +
          '<div class="field"><label>Organización' + tl('org') + '</label><input class="input" type="text" data-field="org"' + ph('org') + ' value="' + escapeAttr(x[f('org')]) + '"></div>' +
          '<div class="field"><label>Responsabilidades (una por línea)' + tl('bulletsStr') + '</label><textarea class="input" rows="4" data-field="bulletsStr"' + ph('bulletsStr') + '>' + escapeHtml(x[f('bulletsStr')]) + '</textarea></div>' +
          '<div class="field"><label>Métricas' + tl('metricsStr') + '</label>' + chipInputHtml('metricsStr', x[f('metricsStr')], 'Ej. Entregado en 6 semanas — Enter para agregar') + '</div>' +
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
    preview.textContent = 'Se mostrará como: "' + text + '"';
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
      if (field === 'startDate' || field === 'endDate') updateExpRangePreview(row, state.experience[i]);
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
      notifyChange();
    });

    container.addEventListener('click', async function (e) {
      if (e.target.dataset.action !== 'remove-exp') return;
      var row = e.target.closest('[data-exp-row]');
      var i = Number(row.dataset.index);
      var exp = state.experience[i];
      var expLabel = [exp.role, exp.org].filter(Boolean).join(' — ');
      if (!(await confirmRemoval('la experiencia', expLabel))) return;
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
      });
      renderExperience();
      notifyChange();
    });
  }

  /* ---------- CERTIFICACIONES (dentro de Educación) ---------- */

  function certRowHtml(c, i) {
    var f = function (field) { return activeField(CERT_TRANSLATABLE, field); };
    return '' +
      '<div class="mini-row mini-row--dated" data-cert-row data-index="' + i + '">' +
        '<input class="input" type="text" data-field="name" placeholder="Nombre del curso' + (isEditingEn() ? ' (en inglés)' : '') + '" value="' + escapeAttr(c[f('name')]) + '">' +
        '<input class="input" type="text" data-field="issuer" placeholder="Institución' + (isEditingEn() ? ' (en inglés)' : '') + '" value="' + escapeAttr(c[f('issuer')]) + '">' +
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
      notifyChange();
    });

    container.addEventListener('click', async function (e) {
      if (e.target.dataset.action !== 'remove-cert') return;
      var row = e.target.closest('[data-cert-row]');
      var i = Number(row.dataset.index);
      if (!(await confirmRemoval('la certificación', state.certifications[i].name))) return;
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
      '<div class="repeat-card" data-edu-entry-row data-index="' + i + '">' +
        '<div class="repeat-card__body">' +
          '<div style="display:flex; justify-content:flex-end; align-items:center;">' +
            '<button type="button" class="remove-btn" data-action="remove-edu-entry">Eliminar ✕</button>' +
          '</div>' +
          '<div class="field"><label>Título / grado' + tl('degree') + '</label><input class="input" type="text" data-field="degree"' + ph('degree') + ' value="' + escapeAttr(x[f('degree')]) + '"></div>' +
          '<div class="field"><label>Institución' + tl('org') + '</label><input class="input" type="text" data-field="org"' + ph('org') + ' value="' + escapeAttr(x[f('org')]) + '"></div>' +
          '<div class="form-grid">' +
            '<div class="field"><label>Fecha de inicio</label>' + window.MPVDatepicker.html('startDate', x.startDate) + '</div>' +
            '<div class="field" data-edu-end-field' + (x.isCurrent ? ' hidden' : '') + '><label>Fecha de fin</label>' + window.MPVDatepicker.html('endDate', x.endDate) + '</div>' +
          '</div>' +
          '<label class="checkbox-label"><input type="checkbox" data-field="isCurrent"' + (x.isCurrent ? ' checked' : '') + '> Actualmente estudiando</label>' +
          '<p class="hint-text" data-edu-range-preview>Se mostrará como: "' + escapeHtml(rangePreview) + '"</p>' +
          '<div class="field"><label>Estatus' + tl('status') + '</label><input class="input" type="text" data-field="status"' + ph('status') + ' value="' + escapeAttr(x[f('status')]) + '"></div>' +
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
    preview.textContent = 'Se mostrará como: "' + text + '"';
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
      if (field === 'startDate' || field === 'endDate') updateEduEntryRangePreview(row, state.educationEntries[i]);
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
      notifyChange();
    });

    container.addEventListener('click', async function (e) {
      if (e.target.dataset.action !== 'remove-edu-entry') return;
      var row = e.target.closest('[data-edu-entry-row]');
      var i = Number(row.dataset.index);
      var label = (state.educationEntries[i].degree || '').trim() || 'sin título';
      if (!(await confirmRemoval('el título', label))) return;
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
      });
      renderEducationEntries();
      notifyChange();
    });
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
        '<input class="input" type="text" data-field="name" placeholder="Idioma' + (isEditingEn() ? ' (en inglés)' : '') + '" value="' + escapeAttr(parts.name) + '">' +
        '<input class="input" type="text" data-field="desc" placeholder="Descripción' + (isEditingEn() ? ' (en inglés)' : '') + '" value="' + escapeAttr(parts.desc) + '">' +
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
      var label = splitLangLine(rows[i].es).name || 'sin título';
      if (!(await confirmRemoval('el idioma', label))) return;
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
  }

  /* ---------- CONTACTO ---------- */

  function contactRowHtml(c, i) {
    var f = activeField(CONTACT_TRANSLATABLE, 'label');
    return '' +
      '<div class="mini-row" data-contact-row data-index="' + i + '">' +
        '<input class="input" type="text" data-field="label" placeholder="Etiqueta (ej. Email)' + (isEditingEn() ? ' (en inglés)' : '') + '" value="' + escapeAttr(c[f]) + '">' +
        '<input class="input" type="text" data-field="value" placeholder="Valor" value="' + escapeAttr(c.value) + '">' +
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
      var label = (state.contact.items[i].label || '').trim() || 'sin título';
      if (!(await confirmRemoval('el contacto', label))) return;
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

    renderProjects();
    bindProjectsList();

    renderSkills();
    bindSkillsList();

    renderExperience();
    bindExperienceList();

    renderEducationEntries();
    bindEducationEntriesList();

    renderCerts();
    bindCertsList();

    renderLanguages();
    bindLanguagesList();

    renderContacts();
    bindContactsList();

    document.addEventListener('mpv-admin:editlangchange', rerenderAllForEditLang);
  });

  window.MPVAdminForms = { renderAll: renderAll };
})();
