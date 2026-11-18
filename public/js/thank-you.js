// Thank-you page: shows the order summary and fires the browser Purchase event.
// The event ID is the same one the server sends in the Conversion API,
// so Meta counts this purchase only once.

(function () {
  const CURRENCY = 'BDT';
  const $ = id => document.getElementById(id);

  function money(amount) {
    return `${Number(amount || 0).toLocaleString('en-US')} Tk`;
  }

  const STATUS_TEXT = {
    Pending: 'Pending confirmation',
    Confirmed: 'Confirmed',
    Shipped: 'Shipped',
    Delivered: 'Delivered',
    Cancelled: 'Cancelled',
    Returned: 'Returned'
  };

  function showMessage(text) {
    $('thanks-loading').hidden = true;
    $('thanks-details').hidden = true;
    $('thanks-message').textContent = text;
    $('thanks-message').hidden = false;
  }

  function renderItems(items) {
    const list = $('order-items');
    list.replaceChildren();

    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'order-line';

      const left = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'order-line-title';
      title.textContent = item.title;

      const detail = document.createElement('div');
      detail.className = 'order-line-detail';
      detail.textContent = `${item.quantity} x ${money(item.unitPrice)}`;

      left.append(title, detail);

      const total = document.createElement('div');
      total.className = 'order-line-total';
      total.textContent = money(item.lineTotal);

      row.append(left, total);
      list.append(row);
    });
  }

  function render(order) {
    $('order-number').textContent = order.orderNumber;
    $('order-status').textContent = STATUS_TEXT[order.status] || order.status;
    renderItems(order.items);
    $('order-subtotal').textContent = money(order.subtotal);
    $('order-delivery').textContent = order.deliveryCharge === 0 ? 'Free' : money(order.deliveryCharge);
    $('order-total').textContent = money(order.total);

    $('thanks-loading').hidden = true;
    $('thanks-details').hidden = false;
  }

  // Browser Purchase event. The eventID matches the server-side Conversion API event.
  // If the page is reloaded, Meta sees the same eventID and does not count it again.
  function trackPurchase(order) {
    PicasoTracking.track('Purchase', {
      content_ids: order.items.map(i => i.productId),
      content_type: 'product',
      value: order.total,
      currency: CURRENCY,
      num_items: order.items.reduce((sum, i) => sum + i.quantity, 0)
    }, order.eventId);
  }

  async function init() {
    const orderNumber = new URLSearchParams(window.location.search).get('order');

    if (!orderNumber) {
      showMessage('We could not find your order. If you placed an order, please contact us.');
      return;
    }

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}`);
      const data = await res.json();

      if (!data.ok) {
        showMessage('We could not find this order. If you placed an order, please contact us.');
        return;
      }

      render(data.order);
      trackPurchase(data.order);
    } catch (err) {
      showMessage('Could not load your order details. Your order is still placed.');
    }
  }

  init();
})();