(function () {
  var raw = JSON.parse(document.getElementById('admin-data').textContent);
  var d = raw.data;

  function splitCsv(s) {
    return (s || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function joinCsv(arr) {
    return (arr || []).join(', ');
  }
  function splitLines(s) {
    return (s || '').split(/\r\n|\r|\n/).map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function joinLines(arr) {
    return (arr || []).join('\n');
  }

  var state = {
    hero: Object.assign({}, d.hero),
    heroFacts: (d.heroFacts || []).map(function (f) { return Object.assign({}, f); }),
    projects: d.projects.map(function (p) {
      return Object.assign({}, p, { stackStr: joinCsv(p.stack) });
    }),
    skills: d.skills.map(function (cat) {
      return {
        name: cat.name,
        nameEn: cat.nameEn,
        items: cat.items.map(function (s) { return Object.assign({}, s); }),
      };
    }),
    experience: d.experience.map(function (x) {
      return Object.assign({}, x, {
        bulletsStr: joinLines(x.bullets),
        bulletsEnStr: joinLines(x.bulletsEn),
        metricsStr: joinCsv(x.metrics),
        metricsEnStr: joinCsv(x.metricsEn),
        // Derivado de endDate (vacío = "Presente"), no se guarda aparte —
        // ver experienceRowHtml()/bindExperienceList() en admin-forms.js.
        isCurrent: !x.endDate,
      });
    }),
    education: Object.assign({}, d.education, {
      languagesStr: joinLines(d.education.languages),
      languagesEnStr: joinLines(d.education.languagesEn),
    }),
    educationEntries: (d.educationEntries || []).map(function (x) {
      return Object.assign({}, x, {
        // Igual que experience: derivado de endDate (vacío = "Presente"), no
        // se guarda aparte — ver eduEntryRowHtml()/bindEducationEntriesList()
        // en admin-forms.js.
        isCurrent: !x.endDate,
      });
    }),
    certifications: d.certifications.map(function (c) { return Object.assign({}, c); }),
    contact: Object.assign({}, d.contact, {
      items: (d.contact.items || []).map(function (c) { return Object.assign({}, c); }),
    }),
    socialLinks: (d.socialLinks || []).map(function (s) { return Object.assign({}, s); }),
  };

  function getByPath(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, obj);
  }
  function setByPath(obj, path, value) {
    var parts = path.split('.');
    var last = parts.pop();
    var target = parts.reduce(function (o, k) { return o[k]; }, obj);
    target[last] = value;
  }

  function notifyChange() {
    document.dispatchEvent(new CustomEvent('mpv-admin:change'));
  }

  // Este mismo botón ahora también cambia el idioma de la INTERFAZ del
  // dashboard (menú, botones, títulos — ver admin-i18n.js), no solo el
  // idioma en el que se guarda el contenido — "cambiar de idioma en el
  // dashboard" pasa a sentirse como cambiar el idioma de todo el sistema
  // (punto 14), en vez de solo afectar los campos de contenido.
  function setEditLang(lang) {
    lang = lang === 'en' ? 'en' : 'es';
    window.MPVAdmin.editLang = lang;
    if (window.MPVAdminI18n) window.MPVAdminI18n.setLang(lang);
    document.dispatchEvent(new CustomEvent('mpv-admin:editlangchange'));
  }

  window.MPVAdmin = {
    state: state,
    csrf: raw.csrf,
    activeSection: 'hero',
    previewOpen: true,
    // Arranca en el mismo idioma que ya resolvió admin-i18n.js (sistema o
    // sesión) para que ambos conceptos empiecen sincronizados — de ahí en
    // adelante el botón "Editando: Español/English" sigue siendo la única
    // forma de cambiar cualquiera de los dos a mano.
    editLang: window.MPVAdminI18n ? window.MPVAdminI18n.currentLang() : 'es',
    utils: { splitCsv: splitCsv, joinCsv: joinCsv, splitLines: splitLines, joinLines: joinLines },
    getByPath: getByPath,
    setByPath: setByPath,
    notifyChange: notifyChange,
    setEditLang: setEditLang,
  };
})();
