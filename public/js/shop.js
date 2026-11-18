// Shop page: loads products from the server, renders cards,
// and handles Add to Cart and Buy Now.
// Prices shown here are for display only. The server calculates the real totals.

(function () {
  const CURRENCY = 'BDT';
  const PLACEHOLDER_IMAGE = '';

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

  // Sends AddToCart to the browser pixel. Value is the sale price times quantity.
  function trackAddToCart(product, quantity) {
    PicasoTracking.track('AddToCart', {
      content_ids: [product._id],
      content_type: 'product',
      content_name: product.title,
      value: product.salePrice * quantity,
      currency: CURRENCY,
      num_items: quantity
    });
  }

  function addToCart(product, quantity) {
    PicasoCart.add(product.category, quantity);
    trackAddToCart(product, quantity);
  }

  function buildCard(product) {
    let quantity = 1;

    const qtyValue = el('span', {}, '1');
    const minusBtn = el('button', {
      type: 'button',
      class: 'qty-btn',
      'aria-label': 'Decrease quantity',
      onclick: () => {
        if (quantity > 1) {
          quantity -= 1;
          refreshQty();
        }
      }
    }, '\u2212');
    const plusBtn = el('button', {
      type: 'button',
      class: 'qty-btn',
      'aria-label': 'Increase quantity',
      onclick: () => {
        if (quantity < 99) {
          quantity += 1;
          refreshQty();
        }
      }
    }, '+');

    function refreshQty() {
      qtyValue.textContent = String(quantity);
      minusBtn.disabled = quantity <= 1;
    }
    refreshQty();

    const imageBox = el('div', { class: 'product-image' },
      product.images && product.images[0]
        ? [el('img', { src: product.images[0], alt: product.title, loading: 'lazy' })]
        : []
    );

    const priceRow = el('div', { class: 'price-row' }, [
      el('span', { class: 'price-regular' }, money(product.regularPrice)),
      el('span', { class: 'price-sale' }, money(product.salePrice))
    ]);

    const children = [
      imageBox,
      el('div', { class: 'product-body' }, [
        el('h2', { class: 'product-title' }, product.title),
        priceRow
      ])
    ];

    // Roller shows the bundle price as a note, since the real price depends on the cart
    if (product.bundlePrice != null) {
      children[1].append(
        el('p', { class: 'price-note' }, `${money(product.bundlePrice)} when bought with Minoxidil`)
      );
    }

    children[1].append(
      el('div', { class: 'card-qty-row' }, [
        el('label', {}, 'Quantity'),
        el('div', { class: 'qty' }, [minusBtn, qtyValue, plusBtn])
      ]),
      el('div', { class: 'card-actions' }, [
        el('button', {
          type: 'button',
          class: 'btn btn-outline',
          onclick: () => {
            addToCart(product, quantity);
            PicasoLayout.openCart();
          }
        }, 'Add to Cart'),
        el('button', {
          type: 'button',
          class: 'btn btn-primary',
          onclick: () => {
            addToCart(product, quantity);
            window.location.href = '/checkout.html';
          }
        }, 'Buy Now')
      ])
    );

    return el('article', { class: 'product-card' }, children);
  }

  function showStatus(message) {
    const grid = document.getElementById('product-grid');
    grid.replaceChildren(el('div', { class: 'shop-status' }, message));
  }

  async function loadProducts() {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || 'Could not load products');

      if (!data.products.length) {
        showStatus('No products are available right now.');
        return;
      }

      const grid = document.getElementById('product-grid');
      grid.replaceChildren(...data.products.map(buildCard));
    } catch (err) {
      showStatus('Could not load products. Please refresh the page.');
    }
  }

  loadProducts();
})();