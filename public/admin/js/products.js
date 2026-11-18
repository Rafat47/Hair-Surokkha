// Admin products page: add, edit and delete any product.
// The business logic dropdown lists the files in src/business/logics.
// Choosing one shows the fields that logic needs.

(function () {
  const listEl = document.getElementById('product-list');
  const pageMessage = document.getElementById('page-message');
  const newButton = document.getElementById('new-product-button');
  const newWrap = document.getElementById('new-product-wrap');
  const newSlot = document.getElementById('new-product-slot');

  let logicList = [];

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

  function val(value) {
    return value == null ? '' : value;
  }

  function isAuthError(err) {
    return err.message === 'Not logged in';
  }

  function firstError(err) {
    if (err.data && err.data.errors) return Object.values(err.data.errors)[0];
    return err.message;
  }

  function field(labelText, control, className = '') {
    return el('div', { class: 'field ' + className }, [
      el('label', {}, labelText),
      control
    ]);
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

  function closeNewForm() {
    newWrap.hidden = true;
    newSlot.replaceChildren();
  }

  // product = null means a new product
  function buildForm(product) {
    const isNew = !product;
    let current = product;

    const initialKey = (current && current.businessLogic) || 'none';
    const initialValues = (current && current.logicValues) || {};

    const inputs = {
      category: el('input', { type: 'text', maxlength: 40, placeholder: 'e.g. skincare, hair, soap' }),
      title: el('input', { type: 'text', maxlength: 120 }),
      description: el('textarea', { rows: 4, maxlength: 5000 }),
      regularPrice: el('input', { type: 'number', min: 0, step: 1 }),
      salePrice: el('input', { type: 'number', min: 0, step: 1 }),
      images: el('textarea', { rows: 3, placeholder: '/uploads/your-image.jpg' }),
      isActive: el('input', { type: 'checkbox' })
    };

    inputs.category.value = val(current && current.category);
    inputs.title.value = val(current && current.title);
    inputs.description.value = val(current && current.description);
    inputs.regularPrice.value = val(current && current.regularPrice);
    inputs.salePrice.value = val(current && current.salePrice);
    inputs.images.value = ((current && current.images) || []).join('\n');
    inputs.isActive.checked = isNew ? true : current.isActive !== false;

    const heading = el('h2', {}, isNew ? 'New product' : current.title);
    inputs.title.addEventListener('input', () => {
      heading.textContent = inputs.title.value.trim() || 'Untitled';
    });

    // Business logic dropdown and its fields
    const logicSelect = el('select', {});
    logicList.forEach(logic => {
      const option = el('option', { value: logic.key }, logic.label);
      if (logic.key === initialKey) option.selected = true;
      logicSelect.append(option);
    });

    let logicInputs = {};
    const logicBox = el('div', { class: 'logic-fields full' });

    function renderLogicFields() {
      const key = logicSelect.value;
      const logic = logicList.find(l => l.key === key);
      const previous = logicInputs;
      logicInputs = {};

      const rows = (logic ? logic.fields : []).map(f => {
        const input = el('input', { type: 'number', min: 0, step: 1 });
        if (previous[f.name]) {
          input.value = previous[f.name].value;
        } else if (key === initialKey) {
          input.value = val(initialValues[f.name]);
        }
        logicInputs[f.name] = input;
        return field(f.label, input);
      });

      logicBox.replaceChildren(...rows);
    }

    logicSelect.addEventListener('change', renderLogicFields);
    renderLogicFields();

    // Thumbnail shows the first image
    const thumb = el('img', { class: 'product-admin-thumb', alt: '' });
    function updateThumb() {
      const first = inputs.images.value.split('\n').map(s => s.trim()).find(Boolean);
      if (first) {
        thumb.src = first;
        thumb.hidden = false;
      } else {
        thumb.removeAttribute('src');
        thumb.hidden = true;
      }
    }
    updateThumb();
    inputs.images.addEventListener('input', updateThumb);

    // Upload adds the new image path to the list
    const fileInput = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp' });
    const uploadStatus = el('p', { class: 'field-hint' });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;

      uploadStatus.textContent = 'Uploading...';
      try {
        const url = await uploadImage(file);
        const list = inputs.images.value.split('\n').map(s => s.trim()).filter(Boolean);
        list.push(url);
        inputs.images.value = list.join('\n');
        updateThumb();
        uploadStatus.textContent = 'Image added. Click Save to keep it.';
      } catch (err) {
        if (!isAuthError(err)) uploadStatus.textContent = err.message;
      } finally {
        fileInput.value = '';
      }
    });

    const message = el('p', { class: 'form-message' });

    function payload() {
      const logicValues = {};
      Object.entries(logicInputs).forEach(([name, input]) => {
        logicValues[name] = input.value;
      });

      return {
        category: inputs.category.value.trim(),
        title: inputs.title.value.trim(),
        description: inputs.description.value.trim(),
        regularPrice: inputs.regularPrice.value,
        salePrice: inputs.salePrice.value,
        businessLogic: logicSelect.value,
        logicValues,
        images: inputs.images.value.split('\n').map(s => s.trim()).filter(Boolean),
        isActive: inputs.isActive.checked
      };
    }

    const saveButton = el('button', {
      type: 'button',
      class: 'btn btn-primary',
      onclick: () => save()
    }, isNew ? 'Add product' : 'Save changes');

    const deleteButton = isNew ? null : el('button', {
      type: 'button',
      class: 'btn btn-danger btn-sm',
      onclick: () => removeProduct()
    }, 'Delete product');

    const cancelButton = isNew ? el('button', {
      type: 'button',
      class: 'btn btn-outline btn-sm',
      onclick: () => closeNewForm()
    }, 'Cancel') : null;

    async function save() {
      message.className = 'form-message';
      message.textContent = '';
      saveButton.disabled = true;
      saveButton.textContent = 'Saving...';

      try {
        if (isNew) {
          const data = await AdminApi.post('/api/admin/products', payload());
          setPageMessage(`"${data.product.title}" was added.`, 'success');
          closeNewForm();
          await loadProducts();
        } else {
          const data = await AdminApi.put(`/api/admin/products/${encodeURIComponent(current._id)}`, payload());
          current = data.product;
          heading.textContent = current.title;
          message.classList.add('success');
          message.textContent = 'Saved.';
        }
      } catch (err) {
        if (!isAuthError(err)) message.textContent = firstError(err);
      } finally {
        saveButton.disabled = false;
        saveButton.textContent = isNew ? 'Add product' : 'Save changes';
      }
    }

    async function removeProduct() {
      if (!confirm(`Delete "${current.title}"? This cannot be undone.`)) return;

      deleteButton.disabled = true;
      try {
        await AdminApi.del(`/api/admin/products/${encodeURIComponent(current._id)}`);
        setPageMessage(`"${current.title}" was deleted.`, 'success');
        await loadProducts();
      } catch (err) {
        deleteButton.disabled = false;
        if (!isAuthError(err)) message.textContent = firstError(err);
      }
    }

    const statusText = isNew
      ? 'Not saved yet'
      : (current.isActive !== false ? 'Shown on the shop' : 'Hidden from the shop');

    return el('article', { class: 'product-admin-card' }, [
      el('div', { class: 'product-admin-head' }, [
        thumb,
        el('div', { class: 'product-admin-title' }, [heading, el('p', {}, statusText)])
      ]),

      el('div', { class: 'product-admin-grid' }, [
        field('Category (any name you choose)', inputs.category),
        field('Title', inputs.title),
        field('Description', inputs.description, 'full'),
        field('Regular price (crossed out), Tk', inputs.regularPrice),
        field('Sale price, Tk', inputs.salePrice),
        field('Business logic', logicSelect, 'full'),
        logicBox,
        field('Image links (one per line)', inputs.images, 'full'),
        el('div', { class: 'field full' }, [
          el('label', {}, 'Upload an image (JPG, PNG or WebP, max 3 MB)'),
          el('div', { class: 'upload-row' }, [fileInput]),
          uploadStatus
        ]),
        el('label', { class: 'checkbox-row full' }, [inputs.isActive, 'Show this product on the shop'])
      ]),

      el('div', { class: 'card-footer' }, [
        message,
        el('div', { class: 'card-buttons' }, [cancelButton, deleteButton, saveButton].filter(Boolean))
      ])
    ]);
  }

  async function loadProducts() {
    try {
      const [logicData, productData] = await Promise.all([
        AdminApi.get('/api/admin/products/business-logics'),
        AdminApi.get('/api/admin/products')
      ]);

      logicList = logicData.logics;

      if (!productData.products.length) {
        listEl.replaceChildren(el('p', {}, 'No products yet. Click "Add product" to create one.'));
        return;
      }

      listEl.replaceChildren(...productData.products.map(buildForm));
    } catch (err) {
      if (!isAuthError(err)) {
        setPageMessage('Could not load products: ' + err.message, 'error');
      }
    }
  }

  newButton.addEventListener('click', () => {
    if (!newWrap.hidden) {
      closeNewForm();
      return;
    }
    newSlot.replaceChildren(buildForm(null));
    newWrap.hidden = false;
    newWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  loadProducts();
})();