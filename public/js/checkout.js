// Checkout page: customer form, delivery area, order summary with quantity +/-,
// upsell box, and order submit. Fires the browser InitiateCheckout event once per page load.
// The server recalculates every price when the order is placed.

(function () {
  const CURRENCY = 'BDT';
  const PHONE_REGEX = /^\d{9,14}$/;

  const $ = id => document.getElementById(id);

  let isInsideDhaka = true;
  let refreshToken = 0;
  let checkoutStarted = false;
  let submitting = false;

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
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  function money(amount) {
    return `${Number(amount || 0).toLocaleString('en-US')} Tk`;
  }

  // ===== Messages and field errors =====
  function setMessage(text, type) {
    const msg = $('form-message');
    msg.textContent = text;
    msg.className = 'form-message' + (type ? ' ' + type : '');
  }

  function clearFieldErrors() {
    ['name', 'phone', 'address'].forEach(field => {
      $('err-' + field).textContent = '';
    });
  }

  function showFieldErrors(errors = {}) {
    Object.entries(errors).forEach(([field, message]) => {
      const node = $('err-' + field);
      if (node) node.textContent = message;
    });
  }

  // Client-side check for quick feedback. The server checks again.
  function readAndValidateForm() {
    clearFieldErrors();

    const name = $('name').value.trim();
    const phone = $('phone').value.replace(/[\s-]/g, '');
    const address = $('address').value.trim();

    const errors = {};
    if (!name) errors.name = 'Please enter your name';
    if (!PHONE_REGEX.test(phone)) errors.phone = 'Phone number must be 9 to 14 digits';
    if (!address) errors.address = 'Please enter your address';

    if (Object.keys(errors).length) {
      showFieldErrors(errors);
      return null;
    }
    return { name, phone, address };
  }

  // ===== Tracking =====
  // Fired once per page load, after the server confirms the cart total.
    // Fired once per page load. The browser pixel and the server both get the same eventId.
  function trackInitiateCheckout(cart) {
    PicasoTracking.track('InitiateCheckout', {
      content_ids: cart.items.map(i => i.category),
      content_type: 'product',
      value: cart.total,
      currency: CURRENCY,
      num_items: cart.items.reduce((sum, i) => sum + i.quantity, 0)
    }, undefined, {
      items: PicasoCart.get(),
      isInsideDhaka
    });
  }

  // ===== Order summary =====
  function lineElement(line) {
    return el('div', { class: 'cart-line' }, [
      el('div', {}, [
        el('div', { class: 'cart-line-title' }, line.title),
        el('div', { class: 'cart-line-price' }, `${money(line.unitPrice)} each`)
      ]),
      el('div', { class: 'cart-line-side' }, [
        el('div', { class: 'qty' }, [
          el('button', {
            type: 'button',
            class: 'qty-btn',
            'aria-label': 'Decrease quantity',
            disabled: line.quantity <= 1,
            onclick: () => PicasoCart.changeQuantity(line.category, -1)
          }, '\u2212'),
          el('span', {}, String(line.quantity)),
          el('button', {
            type: 'button',
            class: 'qty-btn',
            'aria-label': 'Increase quantity',
            disabled: line.quantity >= 99,
            onclick: () => PicasoCart.changeQuantity(line.category, 1)
          }, '+')
        ]),
        el('div', { class: 'cart-line-total' }, money(line.lineTotal)),
        el('button', {
          type: 'button',
          class: 'link-btn',
          onclick: () => PicasoCart.remove(line.category)
        }, 'Remove')
      ])
    ]);
  }

  // Shows the first upsell offered by the server
  function renderUpsell(upsells) {
    const box = $('upsell-box');

    if (!upsells || !upsells.length) {
      box.replaceChildren();
      box.hidden = true;
      return;
    }

    const offer = upsells[0];
    const label = offer.title ? `Add ${offer.title}` : 'Add one more item';

    box.replaceChildren(
      el('p', { class: 'upsell-text' }, offer.message),
      el('button', {
        type: 'button',
        class: 'btn btn-outline btn-block',
        onclick: () => PicasoCart.add(offer.category, 1)
      }, label)
    );
    box.hidden = false;
  }

  function showEmptyState() {
    $('checkout-empty').hidden = false;
    $('checkout-layout').hidden = true;
  }

  // Asks the server for the full breakdown, then redraws the summary.
  async function refreshSummary() {
    const token = ++refreshToken;
    const cartItems = PicasoCart.get();

    if (!cartItems.length) {
      showEmptyState();
      return;
    }

    $('checkout-empty').hidden = true;
    $('checkout-layout').hidden = false;
    $('summary-items').replaceChildren(el('div', { class: 'checkout-loading' }, 'Updating...'));

    try {
      const data = await PicasoCart.calculate(isInsideDhaka);
      if (token !== refreshToken) return; // a newer update has started
      if (!data.ok) throw new Error(data.message || 'Cart error');

      if (!data.items.length) {
        showEmptyState();
        return;
      }

      $('summary-items').replaceChildren(...data.items.map(lineElement));
      renderUpsell(data.upsells);

      $('sum-subtotal').textContent = money(data.subtotal);
      $('sum-delivery').textContent = data.isFreeDelivery ? 'Free' : money(data.deliveryCharge);
      $('sum-total').textContent = money(data.total);
      $('delivery-note').textContent = data.isFreeDelivery
        ? 'Free delivery applied to your order.'
        : (isInsideDhaka ? 'Delivery inside Dhaka.' : 'Delivery outside Dhaka.');

      if (!checkoutStarted) {
        checkoutStarted = true;
        trackInitiateCheckout(data);
      }
    } catch (err) {
      if (token !== refreshToken) return;
      $('summary-items').replaceChildren(
        el('div', { class: 'checkout-loading' }, 'Could not update your order. Please refresh the page.')
      );
    }
  }

  // ===== Submit =====
  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    setMessage('', '');
    const customer = readAndValidateForm();
    if (!customer) return;

    const cartItems = PicasoCart.get();
    if (!cartItems.length) {
      setMessage('Your cart is empty.', 'error');
      return;
    }

    submitting = true;
    $('place-order').disabled = true;
    $('place-order').textContent = 'Placing order...';

    try {
      // Only categories and quantities are sent. The server sets all prices.
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cartItems, isInsideDhaka, customer })
      });
      const data = await res.json();

      if (!data.ok) {
        showFieldErrors(data.errors);
        setMessage(data.message || 'Could not place order. Please try again.', 'error');
        return;
      }

      PicasoCart.clear();
      window.location.href = `/thank-you.html?order=${encodeURIComponent(data.orderNumber)}`;
    } catch (err) {
      setMessage('Network error. Please check your connection and try again.', 'error');
    } finally {
      submitting = false;
      $('place-order').disabled = false;
      $('place-order').textContent = 'Place order';
    }
  }

  // ===== Init =====
  function init() {
    $('checkout-form').addEventListener('submit', handleSubmit);

    document.querySelectorAll('input[name="area"]').forEach(radio => {
      radio.addEventListener('change', () => {
        isInsideDhaka = document.querySelector('input[name="area"]:checked').value === 'inside';
        refreshSummary();
      });
    });

    // Quantity +/-, remove, and upsell clicks all change the cart and trigger this
    window.addEventListener('cart:changed', refreshSummary);

    refreshSummary();
  }

  init();
})();