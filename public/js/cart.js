// Cart stored in the browser (localStorage).
// It holds only product IDs and quantities. Prices always come from the server.

(function () {
  const KEY = 'picaso_cart';
  const MAX_QTY = 99;

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      const items = raw ? JSON.parse(raw) : [];
      // Ignore old entries from before products had IDs
      return Array.isArray(items) ? items.filter(i => i && i.productId) : [];
    } catch (err) {
      return [];
    }
  }

  function write(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('cart:changed'));
  }

  function clampQty(value) {
    const qty = parseInt(value, 10);
    if (!Number.isFinite(qty) || qty < 1) return 1;
    return Math.min(qty, MAX_QTY);
  }

  const Cart = {
    get() {
      return read();
    },

    count() {
      return read().reduce((sum, item) => sum + item.quantity, 0);
    },

    add(productId, quantity = 1) {
      const items = read();
      const existing = items.find(i => i.productId === productId);
      if (existing) {
        existing.quantity = clampQty(existing.quantity + quantity);
      } else {
        items.push({ productId, quantity: clampQty(quantity) });
      }
      write(items);
    },

    setQuantity(productId, quantity) {
      const items = read().map(i =>
        i.productId === productId ? { ...i, quantity: clampQty(quantity) } : i
      );
      write(items);
    },

    // delta is +1 or -1. Quantity never goes below 1 here. Use remove() to delete.
    changeQuantity(productId, delta) {
      const item = read().find(i => i.productId === productId);
      if (!item) return;
      Cart.setQuantity(productId, item.quantity + delta);
    },

    remove(productId) {
      write(read().filter(i => i.productId !== productId));
    },

    clear() {
      write([]);
    },

    // Asks the server for the full breakdown (prices, bundle rules, upsells).
    async calculate(isInsideDhaka = false) {
      const res = await fetch('/api/cart/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: read(), isInsideDhaka })
      });
      return res.json();
    }
  };

  window.PicasoCart = Cart;
})();