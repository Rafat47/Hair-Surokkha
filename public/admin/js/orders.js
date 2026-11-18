// Admin orders page: searchable list, status filter, status changes,
// order details window, and resend of the Meta Purchase event when it failed or was skipped.

(function () {
  const PRODUCT_LABELS = { minoxidil: 'Minoxidil 5%', roller: 'Derma Roller' };
  const META_LABELS = { sent: 'Sent', failed: 'Failed', skipped: 'Not set up', pending: 'Pending' };
  const RESENDABLE = ['failed', 'skipped'];

  const $ = id => document.getElementById(id);
  const state = { page: 1, status: '', q: '' };
  let statuses = [];
  let filterReady = false;

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'class') node.className = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else if (value === true) node.setAttribute(key, '');
      else if (value !== false && value != null) node.setAttribute(key, value);
    }
    const list = Array.isArray(children) ? children : [children];
    for (const child of list) {
      if (child == null) continue;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  function money(amount) {
    return `${Number(amount || 0).toLocaleString('en-US')} Tk`;
  }

  function formatDate(value) {
    return new Date(value).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  function itemsText(items) {
    return items.map(i => `${i.quantity} x ${PRODUCT_LABELS[i.category] || i.category}`).join(', ');
  }

  function isAuthError(err) {
    return err.message === 'Not logged in';
  }

  function showMessage(text, type) {
    const msg = $('page-message');
    msg.textContent = text;
    msg.className = 'form-message' + (type ? ' ' + type : '');
  }

  // ===== List =====
  function fillStatusFilter() {
    if (filterReady) return;
    filterReady = true;
    const select = $('status-filter');
    statuses.forEach(s => select.append(el('option', { value: s }, s)));
  }

  function statusSelect(order) {
    const select = el('select', { class: 'status-select', 'aria-label': 'Order status' });
    statuses.forEach(s => {
      const option = el('option', { value: s }, s);
      if (s === order.status) option.selected = true;
      select.append(option);
    });

    select.addEventListener('change', async () => {
      const newStatus = select.value;
      const previous = order.status;
      select.disabled = true;

      try {
        await AdminApi.patch(`/api/admin/orders/${encodeURIComponent(order._id)}/status`, { status: newStatus });
        order.status = newStatus;
        showMessage(`${order.orderNumber} changed to ${newStatus}.`, 'success');
      } catch (err) {
        select.value = previous;
        if (!isAuthError(err)) showMessage(err.message, 'error');
      } finally {
        select.disabled = false;
      }
    });

    return select;
  }

  function orderRow(order) {
    const metaStatus = order.capi && order.capi.purchaseStatus;

    return el('tr', {}, [
      el('td', {}, [
        el('button', {
          type: 'button',
          class: 'link-order',
          onclick: () => openDetails(order._id)
        }, order.orderNumber)
      ]),
      el('td', {}, formatDate(order.createdAt)),
      el('td', {}, [
        el('div', {}, order.customer.name),
        el('div', { class: 'muted-small' }, order.customer.phone)
      ]),
      el('td', {}, itemsText(order.items)),
      el('td', { class: 'num' }, money(order.total)),
      el('td', {}, META_LABELS[metaStatus] || 'Pending'),
      el('td', {}, statusSelect(order))
    ]);
  }

  async function loadOrders() {
    const body = $('orders-body');
    body.replaceChildren(el('tr', {}, el('td', { colspan: '7', class: 'empty-cell' }, 'Loading orders...')));

    const params = new URLSearchParams({ page: String(state.page) });
    if (state.status) params.set('status', state.status);
    if (state.q) params.set('q', state.q);

    try {
      const data = await AdminApi.get(`/api/admin/orders?${params.toString()}`);
      statuses = data.statuses;
      fillStatusFilter();

      $('page-info').textContent = `Page ${data.page} of ${data.pages} (${data.total} orders)`;
      $('prev-page').disabled = data.page <= 1;
      $('next-page').disabled = data.page >= data.pages;

      if (!data.orders.length) {
        body.replaceChildren(el('tr', {}, el('td', { colspan: '7', class: 'empty-cell' }, 'No orders found.')));
        return;
      }

      body.replaceChildren(...data.orders.map(orderRow));
    } catch (err) {
      if (!isAuthError(err)) {
        body.replaceChildren(el('tr', {}, el('td', { colspan: '7', class: 'empty-cell' }, 'Could not load orders.')));
      }
    }
  }

  // ===== Details window =====
  function infoPair(label, value) {
    return el('div', { class: 'info-pair' }, [
      el('span', { class: 'info-label' }, label),
      el('strong', {}, value)
    ]);
  }

  function section(title, ...children) {
    return el('section', { class: 'modal-section' }, [el('h3', {}, title), ...children]);
  }

  function renderDetails(order) {
    $('modal-title').textContent = order.orderNumber;

    const info = el('div', { class: 'info-grid-2' }, [
      infoPair('Customer', order.customer.name),
      infoPair('Phone', order.customer.phone),
      infoPair('Address', order.customer.address),
      infoPair('Delivery area', order.customer.isInsideDhaka ? 'Inside Dhaka' : 'Outside Dhaka'),
      infoPair('Placed', formatDate(order.createdAt)),
      infoPair('Current status', order.status)
    ]);

    const items = order.items.map(item => el('div', { class: 'detail-line' }, [
      el('span', {}, `${PRODUCT_LABELS[item.category] || item.category} x ${item.quantity} (${money(item.unitPrice)} each)`),
      el('strong', {}, money(item.lineTotal))
    ]));

    const totals = [
      el('div', { class: 'total-line' }, [el('span', {}, 'Subtotal'), el('strong', {}, money(order.subtotal))]),
      el('div', { class: 'total-line' }, [
        el('span', {}, 'Delivery'),
        el('strong', {}, order.deliveryCharge === 0 ? 'Free' : money(order.deliveryCharge))
      ]),
      el('div', { class: 'total-line grand' }, [el('span', {}, 'Total'), el('strong', {}, money(order.total))])
    ];

    const capi = order.capi || {};
    const metaBox = [
      el('p', {}, `Purchase event to Meta: ${META_LABELS[capi.purchaseStatus] || 'Pending'}`)
    ];
    if (capi.purchaseError) {
      metaBox.push(el('p', { class: 'meta-error' }, capi.purchaseError));
    }
    if (RESENDABLE.includes(capi.purchaseStatus)) {
      metaBox.push(el('button', {
        type: 'button',
        class: 'btn btn-outline btn-sm',
        onclick: (e) => resendPurchase(order._id, e.currentTarget)
      }, 'Send Purchase to Meta again'));
    }

    const history = el('ul', { class: 'history' },
      (order.statusHistory || []).map(h => el('li', {}, `${h.status} - ${formatDate(h.changedAt)}`))
    );

    $('modal-body').replaceChildren(
      info,
      section('Items', ...items),
      section('Totals', ...totals),
      section('Meta tracking', el('div', { class: 'meta-box' }, metaBox)),
      section('Status history', history)
    );
  }

  async function loadDetails(id) {
    try {
      const data = await AdminApi.get(`/api/admin/orders/${encodeURIComponent(id)}`);
      renderDetails(data.order);
    } catch (err) {
      if (!isAuthError(err)) {
        $('modal-body').replaceChildren(el('p', { class: 'meta-error' }, err.message));
      }
    }
  }

  async function openDetails(id) {
    $('modal-title').textContent = 'Order details';
    $('modal-body').replaceChildren(el('p', { class: 'muted' }, 'Loading...'));
    $('order-modal').hidden = false;
    document.body.classList.add('no-scroll');
    await loadDetails(id);
  }

  function closeDetails() {
    $('order-modal').hidden = true;
    document.body.classList.remove('no-scroll');
  }

  async function resendPurchase(id, button) {
    button.disabled = true;
    button.textContent = 'Sending...';

    try {
      const data = await AdminApi.post(`/api/admin/orders/${encodeURIComponent(id)}/resend-purchase`);
      const capi = data.capi || {};
      if (capi.purchaseStatus === 'sent') {
        showMessage('Purchase event sent to Meta.', 'success');
      } else {
        const reason = capi.purchaseError ? ` ${capi.purchaseError}` : '';
        showMessage(`Meta status: ${META_LABELS[capi.purchaseStatus] || 'Pending'}.${reason}`, 'error');
      }
    } catch (err) {
      if (!isAuthError(err)) showMessage(err.message, 'error');
    }

    await loadDetails(id);
  }

  // ===== Init =====
  function init() {
    $('status-filter').addEventListener('change', () => {
      state.status = $('status-filter').value;
      state.page = 1;
      loadOrders();
    });

    $('search-form').addEventListener('submit', (e) => {
      e.preventDefault();
      state.q = $('search-input').value.trim();
      state.page = 1;
      loadOrders();
    });

    $('clear-search').addEventListener('click', () => {
      $('search-input').value = '';
      state.q = '';
      state.page = 1;
      loadOrders();
    });

    $('prev-page').addEventListener('click', () => {
      if (state.page > 1) {
        state.page -= 1;
        loadOrders();
      }
    });

    $('next-page').addEventListener('click', () => {
      state.page += 1;
      loadOrders();
    });

    $('modal-close').addEventListener('click', closeDetails);
    $('modal-backdrop').addEventListener('click', closeDetails);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('order-modal').hidden) closeDetails();
    });

    loadOrders();
  }

  init();
})();