/**
 * Recuperación de cambios sin guardar (borrador local).
 *
 * Análisis previo a implementarlo (lo que pedía la especificación antes de
 * agregar cualquier autoguardado):
 *  - Qué se guarda: el mismo `window.MPVAdmin.state` que ya edita el
 *    dashboard (hero, proyectos, habilidades, experiencia, educación,
 *    certificaciones, contacto, apariencia). Nada que no esté ya visible en
 *    el propio formulario.
 *  - Dónde: localStorage, con clave propia de esta app.
 *  - Cuándo se borra: en cuanto "Guardar cambios" confirma éxito contra el
 *    servidor (ver mpv-admin:saved en admin-save.js) — ya no hace falta,
 *    el borrador quedó superado por el guardado real.
 *  - Datos sensibles: no contiene contraseñas ni tokens (el dashboard no
 *    maneja ninguno de esos como campo de formulario). Sí puede incluir
 *    teléfono/correo de contacto, pero esos ya son datos que el propio
 *    administrador ve y edita a diario en el mismo navegador — no es una
 *    exposición nueva.
 *  - Cómo se evita restaurar algo incorrecto: nunca se aplica solo — se
 *    compara contra el estado que acaba de mandar el servidor y, si son
 *    iguales, ni se pregunta. Si son distintos, se muestra un aviso
 *    explícito con "Restaurar" / "Descartar"; nunca se sobreescribe el
 *    formulario en silencio.
 */
(function () {
  var DRAFT_KEY = 'mpv_admin_draft';
  var SAVE_DEBOUNCE_MS = 800;
  var saveTimer = null;

  function currentStateJson() {
    return JSON.stringify(window.MPVAdmin.state);
  }

  function showRestoreBanner(draftRaw) {
    var banner = document.createElement('div');
    banner.className = 'draft-banner';
    banner.setAttribute('role', 'status');
    banner.innerHTML =
      '<span>Encontramos cambios sin guardar de una sesión anterior en este navegador.</span>' +
      '<div class="draft-banner__actions">' +
        '<button type="button" data-draft-restore class="btn-secondary">Restaurar cambios</button>' +
        '<button type="button" data-draft-discard class="btn-secondary">Descartar</button>' +
      '</div>';
    document.body.insertBefore(banner, document.body.firstChild);

    banner.querySelector('[data-draft-restore]').addEventListener('click', function () {
      try {
        var draft = JSON.parse(draftRaw);
        Object.assign(window.MPVAdmin.state, draft);
        if (window.MPVAdminForms && window.MPVAdminForms.renderAll) {
          window.MPVAdminForms.renderAll();
        }
      } catch (e) {
        // Borrador corrupto/ilegible: no se aplica nada, se descarta abajo.
      }
      try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
      banner.remove();
    });

    banner.querySelector('[data-draft-discard]').addEventListener('click', function () {
      try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
      banner.remove();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Espera un tick a que admin-forms.js termine de pintar el estado
    // inicial del servidor antes de comparar contra el borrador.
    setTimeout(function () {
      var draftRaw = null;
      try { draftRaw = localStorage.getItem(DRAFT_KEY); } catch (e) {}
      if (draftRaw && draftRaw !== currentStateJson()) {
        showRestoreBanner(draftRaw);
      }
    }, 0);

    document.addEventListener('mpv-admin:change', function () {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        try { localStorage.setItem(DRAFT_KEY, currentStateJson()); } catch (e) {}
      }, SAVE_DEBOUNCE_MS);
    });

    document.addEventListener('mpv-admin:saved', function () {
      try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
    });
  });
})();
