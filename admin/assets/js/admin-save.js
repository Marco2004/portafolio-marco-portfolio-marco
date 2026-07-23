(function () {
  function buildPayload(state, utils) {
    return {
      hero: state.hero,
      heroFacts: state.heroFacts,
      projects: state.projects.map(function (p) {
        return Object.assign({}, p, { stack: utils.splitCsv(p.stackStr) });
      }),
      skills: state.skills,
      skillLevels: state.skillLevels,
      // endDate solo se limpia AQUÍ, al armar lo que se manda a guardar — en
      // el estado en vivo se deja intacta (ver bindExperienceList()) para que
      // desmarcar "trabajo aquí actualmente" restaure la fecha anterior en la
      // vista previa sin tener que escribirla de nuevo.
      experience: state.experience.map(function (x) {
        return Object.assign({}, x, {
          bullets: utils.splitLines(x.bulletsStr),
          bulletsEn: utils.splitLines(x.bulletsEnStr),
          metrics: utils.splitCsv(x.metricsStr),
          metricsEn: utils.splitCsv(x.metricsEnStr),
          endDate: x.isCurrent ? '' : x.endDate,
        });
      }),
      education: Object.assign({}, state.education, {
        languages: utils.splitLines(state.education.languagesStr),
        languagesEn: utils.splitLines(state.education.languagesEnStr),
      }),
      educationEntries: state.educationEntries.map(function (x) {
        return Object.assign({}, x, { endDate: x.isCurrent ? '' : x.endDate });
      }),
      certifications: state.certifications,
      contact: state.contact,
      socialLinks: state.socialLinks,
    };
  }

  var toastTimer = null;
  // Único componente de aviso del dashboard (éxito, error y carga comparten
  // el mismo toast) — se expone en window.MPVAdmin para que otros módulos
  // (subida de imágenes/CV, guardado) no recurran a alert(), que interrumpe
  // el flujo y no encaja con el resto de la interfaz.
  // variant: true/'error' → error, 'loading' → punto pulsante y no se
  // autooculta (el llamador la reemplaza a mano al terminar), cualquier otra
  // cosa (incl. false/omitido) → éxito.
  // position: 'center' → arriba centrado (ej. aviso de proyecto insignia
  // duplicado, que aparece justo donde está la fila que lo provocó); omitido
  // → arriba a la derecha, el default de siempre.
  function showToast(msg, variant, position) {
    var toast = document.querySelector('[data-toast]');
    var isError = variant === true || variant === 'error';
    var isLoading = variant === 'loading';
    document.querySelector('[data-toast-text]').textContent = msg;
    toast.classList.toggle('toast--error', isError);
    toast.classList.toggle('toast--loading', isLoading);
    toast.classList.toggle('toast--center', position === 'center');
    toast.hidden = false;
    clearTimeout(toastTimer);
    if (!isLoading) {
      toastTimer = setTimeout(function () { toast.hidden = true; }, 2400);
    }
  }
  window.MPVAdmin = window.MPVAdmin || {};
  window.MPVAdmin.showToast = showToast;

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelector('[data-save]').addEventListener('click', function (e) {
      var btn = e.currentTarget;
      var t = window.MPVAdminI18n ? window.MPVAdminI18n.t : function (k) { return k; };

      // Bloquea el guardado por completo si alguna habilidad quedó con un
      // nivel "huérfano" (eliminado de la lista, ver combo:delete-option en
      // admin-forms.js) — el aviso visual (ícono ámbar junto al selector)
      // no basta, porque se puede guardar por encima sin notarlo. Mismo
      // criterio que la validación de "un solo proyecto insignia": no deja
      // avanzar y señala exactamente dónde está el problema.
      var pending = window.MPVAdminForms && window.MPVAdminForms.findNeedsReviewSkill();
      if (pending) {
        if (window.MPVAdmin.showSection) window.MPVAdmin.showSection('skills');
        showToast(t('admin.toast.needsReviewError').replace('%NAME%', pending.skillName), true, 'center');
        // Si la categoría está colapsada (acordeón), la fila existe en el
        // DOM pero con alto 0 — se abre a mano antes de intentar hacer
        // scroll hacia ella, si no el scrollIntoView no tendría a dónde ir.
        var cat = window.MPVAdmin.state.skills[pending.catIndex];
        if (cat && !cat._open) {
          cat._open = true;
          window.MPVAdminForms.renderAll();
        }
        requestAnimationFrame(function () {
          var row = document.querySelector('[data-cat-row][data-index="' + pending.catIndex + '"] [data-item-index="' + pending.itemIndex + '"]');
          if (!row) return;
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          var combo = row.querySelector('[data-combo]');
          var target = combo || row;
          target.classList.remove('is-field-shaking');
          void target.offsetWidth;
          target.classList.add('is-field-shaking');
        });
        return;
      }

      btn.disabled = true;
      showToast(t('admin.toast.saving'), 'loading');
      var payload = buildPayload(window.MPVAdmin.state, window.MPVAdmin.utils);
      fetch('../api/save.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.MPVAdmin.csrf },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().then(function (json) {
            if (!res.ok) {
              var err = new Error(json.error || t('admin.toast.saveError'));
              err.status = res.status;
              throw err;
            }
            return json;
          });
        })
        .then(function () {
          showToast(t('admin.toast.default'), false);
          // El borrador local (ver admin-draft.js) ya no hace falta: lo que
          // tenía se acaba de guardar de verdad en el servidor.
          document.dispatchEvent(new CustomEvent('mpv-admin:saved'));
        })
        .catch(function (err) {
          // Una sesión que expiró por inactividad (require_login_api() en
          // api/save.php responde 401 "No autenticado") antes solo mostraba
          // este mismo toast de error genérico y se quedaba ahí — el admin
          // podía darle "Guardar" una y otra vez sin que nunca funcionara, sin
          // ninguna pista de que hacía falta iniciar sesión de nuevo. Lo
          // editado no se pierde (admin-draft.js ya lo tiene en localStorage
          // y lo ofrece restaurar tras volver a entrar), así que es seguro
          // mandarlo derecho a login.php en vez de dejarlo atorado aquí.
          if (err.status === 401) {
            showToast(t('admin.toast.sessionExpired'), true);
            setTimeout(function () { window.location.href = 'login.php'; }, 1600);
            return;
          }
          showToast(err.message, true);
        })
        .finally(function () {
          btn.disabled = false;
        });
    });
  });
})();
