// Admin products page: one card per product with an edit form.
// Saves through PUT /api/admin/products/:id. Images can be uploaded or entered as links.

(function () {
  const listEl = document.getElementById('product-list');
  const pageMessage = document.getElementById('page-message');

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'class') node.className = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else if (value === true) node.setAttribute(key, '');
      else if (value !== false && value != null) node.setAttribute(key, value);
    }
    const items = Array.isArray(children) ? children : [children];
    for (const child of items) {
      if (child == null) continue;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  function setPageMessage(text, type) {
    pageMessage.textContent = text;
    pageMessage.className = 'form-message' + (type ? ' ' + type : '');
  }

  function makeInput(type, value, extra = {}) {
    const node = el('input', Object.assign({ type }, extra));
    node.value = value == null ? '' : value;
    return node;
  }

  function field(labelText, control, className = '') {
    return el('div', { class: 'field ' + className }, [
      el('label', {}, labelText),
      control
    ]);
  }

  // Same rule as the checkout upsell (pricing.js offerPercent)
  function upsellPercent(category, regular, sale, bundle) {
    if (category === 'roller') {
      return sale > 0 ? Math.round(((sale - bundle) / sale) * 100) : 0;
    }
    return regular > 0 ? Math.round(((regular - sale) / regular) * 100) : 0;
  }

  async function uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch('/api/admin/products/upload', {
      method: 'POST',
      body: formData,
      credentials: 'same-origin'
    });

    if (res.status === 401) {
      window.location.href = '/admin/login.html';
      throw new Error('Not logged in');
    }

    const data = await res.json();
    if (!data.ok) throw new Error(data.message || 'Upload failed');
    return data.url;
  }

  function productCard(product) {
    const isRoller = product.category === 'roller';

    const titleInput = makeInput('text', product.title, { maxlength: 120 });

    const descInput = el('textarea', { rows: 4, maxlength: 5000 });
    descInput.value = product.description || '';

    const regularInput = makeInput('number', product.regularPrice, { min: 0, step: 1 });
    const saleInput = makeInput('number', product.salePrice, { min: 0, step: 1 });
    const bundleInput = makeInput('number', product.bundlePrice, { min: 0, step: 1 });

    const imagesInput = el('textarea', { rows: 3 });
    imagesInput.value = (product.images || []).join('\n');

    const activeInput = el('input', { type: 'checkbox' });
    activeInput.checked = product.isActive !== false;

    // Live upsell hint
    const hint = el('p', { class: 'hint-pill' });
    function updateHint() {
      const regular = Number(regularInput.value);
      const sale = Number(saleInput.value);
      const bundle = Number(bundleInput.value);
      const pct = upsellPercent(product.category, regular, sale, bundle);

      hint.textContent = isRoller
        ? `Shown at checkout when a customer has Minoxidil: "Add a derma roller to get ${pct}% off"`
        : `Shown at checkout when a customer has Derma Roller: "Add another product to get ${pct}% off"`;
    }
    [regularInput, saleInput, bundleInput].forEach(input => input.addEventListener('input', updateHint));
    updateHint();

    // Thumbnail shows the first image
    const thumb = el('img', { class: 'product-admin-thumb', alt: '' });
    function updateThumb() {
      const first = imagesInput.value.split('\n').map(s => s.trim()).find(Boolean);
      if (first) {
        thumb.src = first;
        thumb.hidden = false;
      } else {
        thumb.removeAttribute('src');
        thumb.hidden = true;
      }
    }
    updateThumb();
    imagesInput.addEventListener('input', updateThumb);

    // Image upload: adds the uploaded path to the image list
    const fileInput = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp' });
    const uploadStatus = el('p', { class: 'field-hint' });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;

      uploadStatus.textContent = 'Uploading...';
      try {
        const url = await uploadImage(file);
        const current = imagesInput.value.split('\n').map(s => s.trim()).filter(Boolean);
        current.push(url);
        imagesInput.value = current.join('\n');
        updateThumb();
        uploadStatus.textContent = 'Image added. Click Save to keep it.';
      } catch (err) {
        if (err.message !== 'Not logged in') uploadStatus.textContent = err.message;
      } finally {
        fileInput.value = '';
      }
    });

    const message = el('p', { class: 'form-message' });
    const saveButton = el('button', { type: 'button', class: 'btn btn-primary' }, 'Save changes');

    saveButton.addEventListener('click', async () => {
      const payload = {
        title: titleInput.value,
        description: descInput.value,
        regularPrice: regularInput.value,
        salePrice: saleInput.value,
        bundlePrice: isRoller ? bundleInput.value : null,
        images: imagesInput.value.split('\n').map(s => s.trim()).filter(Boolean),
        isActive: activeInput.checked
      };

      saveButton.disabled = true;
      saveButton.textContent = 'Saving...';
      message.className = 'form-message';
      message.textContent = '';

      try {
        await AdminApi.put(`/api/admin/products/${encodeURIComponent(product._id)}`, payload);
        message.classList.add('success');
        message.textContent = 'Saved.';
      } catch (err) {
        const errors = err.data && err.data.errors;
        message.textContent = errors ? Object.values(errors)[0] : err.message;
      } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Save changes';
      }
    });

    const headTitle = el('div', { class: 'product-admin-title' }, [
      el('h2', {}, product.title),
      el('p', {}, isRoller ? 'Derma Roller' : 'Minoxidil')
    ]);
    titleInput.addEventListener('input', () => {
      headTitle.querySelector('h2').textContent = titleInput.value || 'Untitled';
    });

    return el('article', { class: 'product-admin-card' }, [
      el('div', { class: 'product-admin-head' }, [thumb, headTitle]),

      el('div', { class: 'product-admin-grid' }, [
        field('Title', titleInput, 'full'),
        field('Description', descInput, 'full'),
        field('Regular price (crossed out), Tk', regularInput),
        field('Sale price, Tk', saleInput),
        isRoller ? field('Bundle price with Minoxidil, Tk', bundleInput) : null,
        el('div', { class: 'full' }, [hint]),
        field('Image links (one per line)', imagesInput, 'full'),
        el('div', { class: 'field full' }, [
          el('label', {}, 'Upload an image (JPG, PNG or WebP, max 3 MB)'),
          el('div', { class: 'upload-row' }, [fileInput]),
          uploadStatus
        ]),
        el('label', { class: 'checkbox-row full' }, [activeInput, 'Show this product on the shop'])
      ]),

      el('div', { class: 'card-footer' }, [message, saveButton])
    ]);
  }

  async function load() {
    try {
      const data = await AdminApi.get('/api/admin/products');
      if (!data.products || !data.products.length) {
        listEl.replaceChildren(el('p', {}, 'No products yet.'));
        return;
      }
      listEl.replaceChildren(...data.products.map(productCard));
    } catch (err) {
      if (err.message !== 'Not logged in') {
        setPageMessage('Could not load products: ' + err.message, 'error');
      }
    }
  }

  load();
})();