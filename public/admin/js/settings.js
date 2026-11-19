// Admin settings page. Loads current values, validates through the server, and saves.
// The Conversion API token is never shown: the page only shows whether one is saved.

(function () {
  const FIELDS = [
    'deliveryInsideDhaka',
    'deliveryOutsideDhaka',
    'freeDeliveryMinMinoxidil',
    'minoxidilTwoPiecePrice',
    'minoxidilThreePiecePrice',
    'metaPixelId',
    'metaTestEventCode'
  ];

  const $ = id => document.getElementById(id);

  function setMessage(text, type) {
    const msg = $('page-message');
    msg.textContent = text;
    msg.className = 'form-message' + (type ? ' ' + type : '');
  }

  function clearErrors() {
    document.querySelectorAll('.field-error').forEach(node => { node.textContent = ''; });
  }

  function showErrors(errors = {}) {
    Object.entries(errors).forEach(([field, message]) => {
      const node = $('err-' + field);
      if (node) node.textContent = message;
    });
  }

  function setTokenStatus(hasToken) {
    const status = $('token-status');
    status.textContent = hasToken
      ? 'A token is saved. For security it is hidden. Paste a new one to replace it.'
      : 'No token saved yet. Server-side Meta events are skipped until you add one.';
    status.className = 'token-status ' + (hasToken ? 'ok' : 'warn');
  }

  function fill(settings) {
    FIELDS.forEach(field => {
      $(field).value = settings[field] ?? '';
    });
    $('currency').value = settings.currency || 'BDT';
    $('capiLogEnabled').checked = Boolean(settings.capiLogEnabled);
    setTokenStatus(settings.hasCapiToken);
  }

  function readForm() {
    const data = {};
    FIELDS.forEach(field => {
      data[field] = $(field).value.trim();
    });
    data.metaCapiToken = $('metaCapiToken').value.trim();
    data.clearToken = $('clearToken').checked;
    data.capiLogEnabled = $('capiLogEnabled').checked;
    return data;
  }

  async function load() {
    try {
      const data = await AdminApi.get('/api/admin/settings');
      fill(data.settings);
    } catch (err) {
      if (err.message !== 'Not logged in') {
        setMessage('Could not load settings. Please refresh the page.', 'error');
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    clearErrors();
    setMessage('', '');

    const button = $('save-button');
    button.disabled = true;
    button.textContent = 'Saving...';

    try {
      const data = await AdminApi.put('/api/admin/settings', readForm());
      fill(data.settings);

      $('metaCapiToken').value = '';
      $('clearToken').checked = false;

      setMessage('Settings saved.', 'success');
    } catch (err) {
      if (err.data && err.data.errors) {
        showErrors(err.data.errors);
        setMessage('Please check the highlighted fields.', 'error');
      } else if (err.message !== 'Not logged in') {
        setMessage(err.message, 'error');
      }
    } finally {
      button.disabled = false;
      button.textContent = 'Save settings';
    }
  }

  function init() {
    $('settings-form').addEventListener('submit', handleSubmit);
    load();
  }

  init();
})();