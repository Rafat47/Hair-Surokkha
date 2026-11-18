// Cart stored in the browser (localStorage).
// It holds only product ids and quantities. Prices always come from the server.

(function () {
  const KEY = 'picaso_cart';
  const MAX_QTY = 99;

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      const items = raw ? JSON.parse(raw) : [];
      return Array.isArray(items) ? items : [];
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

    add(id, quantity = 1) {
      const items = read();
      const existing = items.find(i => i.id === id);
      if (existing) {
        existing.quantity = clampQty(existing.quantity + quantity);
      } else {
        items.push({ id, quantity: clampQty(quantity) });
      }
      write(items);
    },

    setQuantity(id, quantity) {
      const items = read().map(i =>
        i.id === id ? { ...i, quantity: clampQty(quantity) } : i
      );
      write(items);
    },

    // delta is +1 or -1. Quantity never goes below 1 here. Use remove() to delete.
    changeQuantity(id, delta) {
      const item = read().find(i => i.id === id);
      if (!item) return;
      Cart.setQuantity(id, item.quantity + delta);
    },

    remove(id) {
      write(read().filter(i => i.id !== id));
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
