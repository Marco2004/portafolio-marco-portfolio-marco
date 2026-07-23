window.MPVAdminUpload = (function () {
  function t(key, fallback) {
    return window.MPVAdminI18n ? window.MPVAdminI18n.t(key) : fallback;
  }

  function uploadFile(url, file) {
    var fd = new FormData();
    fd.append('file', file);
    return fetch(url, {
      method: 'POST',
      headers: { 'X-CSRF-Token': window.MPVAdmin.csrf },
      body: fd,
    }).then(function (res) {
      return res.json().then(function (json) {
        if (!res.ok) throw new Error(json.error || t('admin.upload.error', 'Error al subir el archivo'));
        return json;
      });
    });
  }

  function setupZone(zone) {
    var input = zone.querySelector('[data-project-image-input]');
    var index = Number(zone.dataset.index);

    function handleFile(file) {
      if (!file) return;
      window.MPVAdmin.showToast(t('admin.upload.uploading', 'Subiendo imagen…'), 'loading');
      uploadFile('../api/upload-image.php', file).then(function (json) {
        window.MPVAdmin.state.projects[index].image = json.path;
        zone.style.backgroundImage = "url('../public/uploads/projects/" + json.path + "')";
        var label = zone.querySelector('.image-drop-zone__label');
        if (label) label.remove();
        window.MPVAdmin.notifyChange(true);
        window.MPVAdmin.showToast(t('admin.upload.success', 'Imagen actualizada correctamente'), false);
      }).catch(function (err) {
        window.MPVAdmin.showToast(err.message, true);
      });
    }

    zone.addEventListener('click', function () { input.click(); });
    // role="button" (ver projectRowHtml() en admin-forms.js) no activa el
    // click con Enter/Espacio por sí solo — a diferencia de un <button> real,
    // eso hay que cablearlo a mano.
    zone.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      input.click();
    });
    input.addEventListener('change', function () { handleFile(input.files[0]); });
    zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('is-dragover'); });
    zone.addEventListener('dragleave', function () { zone.classList.remove('is-dragover'); });
    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      zone.classList.remove('is-dragover');
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
  }

  function bindProjectZones() {
    document.querySelectorAll('[data-project-image-zone]').forEach(setupZone);
  }

  return { bindProjectZones: bindProjectZones };
})();
