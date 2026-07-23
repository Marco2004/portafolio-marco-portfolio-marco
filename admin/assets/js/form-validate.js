/**
 * Validación de formularios propia, para reemplazar los globos nativos del
 * navegador ("Rellena este campo", "Incluye un signo @ en la dirección de
 * correo electrónico"), que no se pueden diseñar y se ven/dicen distinto en
 * cada navegador. Mismo criterio que password-strength.js: un mensaje
 * aparece junto al campo con la misma animación de fundido+deslizamiento
 * (ver .field-hint en admin-base.css), respeta prefers-reduced-motion, y no
 * reemplaza la validación real del servidor — solo evita el viaje redondo
 * cuando el error ya es obvio en el navegador.
 *
 * Se engancha a cualquier <form> de las páginas de auth (login, setup,
 * forgot-password, reset-password, verify) sobre sus campos con `required`
 * o type="email" — el resto de los campos de esos formularios no necesita
 * nada de esto. El dashboard (admin/index.php) no tiene campos `required` en
 * su contenido, así que ahí este módulo no hace nada.
 */
(function () {
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fieldWrapper(input) {
    return input.closest('.field') || input.parentElement;
  }

  function fieldMessage(input) {
    var v = input.validity;
    if (v.valueMissing) return 'Este campo es obligatorio.';
    if (v.typeMismatch && input.type === 'email') return 'Escribe un correo electrónico válido (con @).';
    if (v.tooShort) return 'Debe tener al menos ' + input.minLength + ' caracteres.';
    if (v.patternMismatch) {
      return input.id === 'code' ? 'Escribe el código de 6 dígitos que te enviamos por correo.' : 'El formato no es válido.';
    }
    return input.validationMessage || 'Revisa este campo.';
  }

  function getOrCreateHint(input) {
    var wrapper = fieldWrapper(input);
    var hint = wrapper.querySelector('[data-field-hint]');
    if (!hint) {
      hint = document.createElement('p');
      hint.className = 'field-hint';
      hint.setAttribute('data-field-hint', '');
      hint.hidden = true;
      wrapper.appendChild(hint);
    }
    return hint;
  }

  function showError(input, message) {
    var hint = getOrCreateHint(input);
    hint.textContent = message;
    hint.hidden = false;
    input.setAttribute('aria-invalid', 'true');
  }

  function clearError(input) {
    var wrapper = fieldWrapper(input);
    var hint = wrapper.querySelector('[data-field-hint]');
    if (hint) hint.hidden = true;
    input.removeAttribute('aria-invalid');
  }

  // #confirm debe ser igual a #password (setup.php, reset-password.php) —
  // no es parte de la Constraint Validation API nativa, se revisa a mano
  // con el mismo criterio que el servidor (ver setup.php/reset-password.php).
  // Se compara con trim() en ambos lados: el servidor recorta la contraseña
  // antes de guardarla/verificarla (ver el mismo trim() en setup.php/
  // reset-password.php), así que un espacio accidental al inicio/final en
  // uno de los dos campos no debe mostrarse aquí como "no coinciden" cuando
  // el servidor sí las aceptaría como iguales.
  function checkConfirmMatch(input) {
    if (input.id !== 'confirm' || !input.form) return true;
    var pw = input.form.querySelector('#password');
    if (pw && input.value.trim() && pw.value.trim() !== input.value.trim()) {
      showError(input, 'Las contraseñas no coinciden.');
      return false;
    }
    return true;
  }

  function validateField(input) {
    if (!input.checkValidity()) {
      showError(input, fieldMessage(input));
      return false;
    }
    if (!checkConfirmMatch(input)) return false;
    clearError(input);
    return true;
  }

  function shake(input) {
    if (reduceMotion) return;
    var wrapper = fieldWrapper(input);
    wrapper.classList.remove('is-field-shaking');
    void wrapper.offsetWidth;
    wrapper.classList.add('is-field-shaking');
  }

  function hasVisibleError(input) {
    var wrapper = fieldWrapper(input);
    var hint = wrapper.querySelector('[data-field-hint]');
    return !!(hint && !hint.hidden);
  }

  function enhanceForm(form) {
    var fields = form.querySelectorAll('input[required], textarea[required], input[type="email"]');
    if (!fields.length) return;
    form.setAttribute('novalidate', '');

    // Antes se validaba en CUALQUIER blur, incluso de un campo vacío que el
    // usuario nunca tocó — perder el foco por cualquier motivo ajeno a
    // escribir (p. ej. dar clic en el switch de tema) ya lo marcaba en rojo
    // como "obligatorio". Ahora un campo vacío solo se valida al perder el
    // foco si ya se intentó enviar el formulario una vez (submitted); si ya
    // tiene contenido, sí se valida de inmediato al salir (para avisar de un
    // correo mal escrito, etc. — eso sí es una revisión real, no "cualquier
    // movimiento").
    var submitted = false;

    fields.forEach(function (input) {
      input.addEventListener('blur', function () {
        // Recorta espacios visibles al inicio/final en campos de texto/correo
        // (usuario, correo, identificador) al salir del campo — así lo que se
        // ve coincide con lo que el servidor va a guardar/comparar (que ya
        // aplica trim(), ver login.php/setup.php/forgot-password.php). Los
        // campos de contraseña NO se tocan aquí: se dejan tal cual se
        // escribieron, el trim() de la contraseña ocurre solo en servidor.
        if (input.type === 'text' || input.type === 'email') {
          var trimmed = input.value.trim();
          if (trimmed !== input.value) input.value = trimmed;
        }
        if (!submitted && input.value.trim() === '') return;
        validateField(input);
      });
      // Revalida en vivo solo si ya había un error visible — no molestar
      // mientras el usuario todavía escribe por primera vez.
      input.addEventListener('input', function () {
        if (hasVisibleError(input)) validateField(input);
      });
    });

    // Si #password cambia y #confirm ya tenía un error mostrado, revisar de
    // nuevo (típicamente pasa al corregir la contraseña antes que la
    // confirmación).
    var passwordInput = form.querySelector('#password');
    var confirmInput = form.querySelector('#confirm');
    if (passwordInput && confirmInput) {
      passwordInput.addEventListener('input', function () {
        if (confirmInput.value && hasVisibleError(confirmInput)) validateField(confirmInput);
      });
    }

    form.addEventListener('submit', function (e) {
      submitted = true;
      var firstInvalid = null;
      fields.forEach(function (input) {
        var ok = validateField(input);
        if (!ok && !firstInvalid) firstInvalid = input;
      });
      if (firstInvalid) {
        e.preventDefault();
        // form-loading.js escucha "submit" en document (fase de burbuja) y
        // deja el botón deshabilitado con el spinner puesto asumiendo que la
        // página va a navegar — si no se detiene aquí la propagación, el
        // botón se quedaría "cargando" para siempre tras un envío inválido,
        // ya que nunca llega la navegación que lo reiniciaría.
        e.stopPropagation();
        firstInvalid.focus();
        shake(firstInvalid);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('form').forEach(enhanceForm);
  });
})();
