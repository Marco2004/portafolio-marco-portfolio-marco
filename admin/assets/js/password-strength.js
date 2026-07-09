/**
 * Medidor de fortaleza de contraseña en tiempo real, diseñado para este
 * proyecto (no una librería genérica). Se engancha a cualquier <input
 * type="password" data-strength-input> que tenga inmediatamente después (o
 * dentro del mismo .field) un contenedor [data-password-strength].
 *
 * Nivel 1 "Muy débil" es intencionalmente el mismo criterio que rechaza el
 * servidor en validate_password_strength() (src/auth.php): contraseña común,
 * igual al usuario/correo, o un patrón trivial (repetida/secuencial). Eso
 * hace que el botón de enviar se deshabilite exactamente cuando el servidor
 * de todos modos la rechazaría — no antes (no se exige mayúscula+símbolo a
 * fuerza, siguiendo NIST 800-63B: longitud + lista negra pesan más que
 * combinaciones arbitrarias).
 */
(function () {
  // Subconjunto de las contraseñas más filtradas/reutilizadas (listas
  // públicas tipo RockYou). No pretende ser exhaustivo: solo atrapa los
  // casos obvios que un usuario real podría escribir sin pensar.
  var COMMON_PASSWORDS = [
    '123456', 'password', '123456789', '12345678', '12345', '1234567',
    '1234567890', 'qwerty', 'abc123', '111111', '123123', 'letmein',
    'welcome', 'monkey', 'login', 'admin', 'iloveyou', '1q2w3e4r', '000000',
    'qwerty123', 'dragon', 'master', 'hello', 'freedom', 'whatever',
    'qazwsx', 'trustno1', '654321', 'superman', '1qaz2wsx', 'sunshine',
    'princess', 'football', 'shadow', 'michael', 'jennifer', 'jordan',
    'hunter', 'buster', 'harley', 'ranger', 'daniel', 'starwars', '112233',
    'george', 'computer', 'michelle', 'jessica', 'pepper', '1111', 'zxcvbn',
    '555555', '11111111', '131313', '123321', 'asdf', 'asdfgh',
    'qwertyuiop', 'passw0rd', 'p@ssw0rd', 'p@ssword', 'changeme', 'root',
    'toor', 'administrator', 'guest', 'test', 'test123', 'temp', 'temp123',
    'default', 'letmein123', 'baseball', 'soccer', 'batman', 'spiderman',
    'ninja', 'mustang', 'access', 'flower', 'hottie', 'loveme', 'biteme',
    'jesus', 'trustme', 'cheese', 'banana', 'purple', 'orange', 'yellow',
    'chicken', 'asdfasdf', '1234', '12345678910', 'welcome1', 'abcd1234',
    '1a2b3c4d', 'contraseña', 'contrasena', 'password1', 'password123'
  ];

  var LEVELS = [
    { key: 'empty', label: '', className: '' },
    { key: 'very-weak', label: 'Muy débil', className: 'is-veryweak' },
    { key: 'weak', label: 'Débil', className: 'is-weak' },
    { key: 'fair', label: 'Regular', className: 'is-fair' },
    { key: 'strong', label: 'Fuerte', className: 'is-strong' },
    { key: 'very-strong', label: 'Muy fuerte', className: 'is-verystrong' }
  ];

  function isRepeatedOrSequential(pw) {
    if (/^(.)\1+$/.test(pw)) return true; // "aaaaaaaa"
    var seqUp = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var seqDown = seqUp.split('').reverse().join('');
    var lower = pw.toLowerCase();
    return seqUp.indexOf(lower) !== -1 || seqDown.indexOf(lower) !== -1;
  }

  /**
   * context: array de strings (usuario, correo) contra los que no debe
   * coincidir la contraseña. Devuelve { level: 0-5, label, className, hardFail }.
   * hardFail === true significa "el servidor la rechazaría" (ver auth.php).
   */
  function scorePassword(pw, context) {
    pw = pw || '';
    if (pw.length === 0) {
      return Object.assign({ level: 0, hardFail: true }, LEVELS[0]);
    }
    if (pw.length < 8) {
      return Object.assign({ level: 1, hardFail: true }, LEVELS[1]);
    }

    var lowerPw = pw.toLowerCase();
    var isCommon = COMMON_PASSWORDS.indexOf(lowerPw) !== -1;
    var matchesContext = (context || []).some(function (c) {
      return c && c.length >= 3 && lowerPw.indexOf(c.toLowerCase()) !== -1;
    });
    var trivialPattern = isRepeatedOrSequential(pw);

    if (isCommon || matchesContext || trivialPattern) {
      return Object.assign({ level: 1, hardFail: true }, LEVELS[1]);
    }

    var hasLower = /[a-z]/.test(pw);
    var hasUpper = /[A-Z]/.test(pw);
    var hasDigit = /[0-9]/.test(pw);
    var hasSymbol = /[^a-zA-Z0-9]/.test(pw);
    var variety = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;

    if (variety === 1 && pw.length < 10) {
      return Object.assign({ level: 1, hardFail: false }, LEVELS[1]);
    }

    var points = 1; // ya pasó el mínimo de 8 caracteres y los filtros duros
    if (pw.length >= 12) points += 1;
    if (pw.length >= 16) points += 1;
    points += variety;

    var level;
    if (points <= 2) level = 2;
    else if (points === 3) level = 3;
    else if (points === 4) level = 4;
    else level = 5;

    return Object.assign({ level: level, hardFail: false }, LEVELS[level]);
  }

  function resolveContext(selectorList) {
    if (!selectorList) return [];
    return selectorList.split(',').map(function (sel) {
      var el = document.querySelector(sel.trim());
      return el ? el.value : '';
    });
  }

  function enhanceOne(input) {
    var wrapper = input.closest('.field') || input.parentElement;
    var meter = wrapper ? wrapper.querySelector('[data-password-strength]') : null;
    if (!meter) return;

    var fill = meter.querySelector('[data-password-strength-fill]');
    var label = meter.querySelector('[data-password-strength-label]');
    var form = input.form;
    var submitBtn = form ? form.querySelector('[type="submit"]') : null;
    var contextSelectors = input.getAttribute('data-strength-context');

    function update() {
      var result = scorePassword(input.value, resolveContext(contextSelectors));
      meter.hidden = input.value.length === 0;
      meter.className = 'password-strength ' + (result.className || '');
      fill.setAttribute('data-level', String(result.level));
      label.textContent = result.label;

      if (submitBtn) {
        submitBtn.disabled = result.hardFail === true;
        submitBtn.classList.toggle('is-disabled-hint', result.hardFail === true);
      }
    }

    input.addEventListener('input', update);
    update();
  }

  function enhance(root) {
    (root || document).querySelectorAll('[data-strength-input]').forEach(enhanceOne);
  }

  document.addEventListener('DOMContentLoaded', function () {
    enhance(document);
  });

  window.MPVPasswordStrength = { enhance: enhance, scorePassword: scorePassword };
})();
