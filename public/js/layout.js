// Shared layout: header, cart drawer and footer.
// Every page loads this file at the end of <body>. Edit CONFIG below for contact info and social links.

(function () {
  const CONFIG = {
    brandName: 'Picaso',
    phone: '+880 1XXX-XXXXXX',          // replace with your phone number
    email: 'hello@yourdomain.com',      // replace with your email
    address: 'Sonirakra, Dhonia, Dhaka - 1204',
    social: {
      facebook: '#',                    // replace with your page URLs
      instagram: '#',
      tiktok: '#'
    }
  };

  const NAV = [
    { href: '/', label: 'Home' },
    { href: '/shop.html', label: 'Shop' },
    { href: '/about.html', label: 'About Us' },
    { href: '/contact.html', label: 'Contact Us' }
  ];

  const CART_SVG = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="9" cy="20" r="1.5"></circle>
      <circle cx="18" cy="20" r="1.5"></circle>
      <path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6"></path>
    </svg>`;

  // Small helper that builds DOM nodes safely (no innerHTML with user data)
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

  // ===== Markup =====
  function headerHTML() {
    const links = NAV.map(n => `<a href="${n.href}">${n.label}</a>`).join('');
    return `
      <header class="site-header">
        <div class="container header-inner">
          <a href="/" class="brand">${CONFIG.brandName}</a>
          <nav class="site-nav" id="site-nav">${links}</nav>
          <div class="header-actions">
            <button class="cart-button" id="cart-open" aria-label="Open cart">
              ${CART_SVG}
              <span class="cart-count" id="cart-count">0</span>
            </button>
            <button class="menu-toggle" id="menu-toggle" aria-label="Open menu" aria-expanded="false">
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>
      </header>`;
  }

  function drawerHTML() {
    return `
      <div class="drawer-overlay" id="drawer-overlay"></div>
      <aside class="cart-drawer" id="cart-drawer" aria-hidden="true" aria-label="Shopping cart">
        <div class="drawer-header">
          <h2>Your cart</h2>
          <button class="icon-btn" id="cart-close" aria-label="Close cart">&times;</button>
        </div>
        <div class="drawer-body" id="cart-body"></div>
        <div class="drawer-footer">
          <div class="drawer-subtotal">
            <span>Subtotal</span>
            <strong id="cart-subtotal">0 Tk</strong>
          </div>
          <p class="drawer-note" id="cart-note"></p>
          <a href="/checkout.html" class="btn btn-primary btn-block" id="cart-checkout">Checkout</a>
        </div>
      </aside>`;
  }

  function footerHTML() {
    return `
      <footer class="site-footer">
        <div class="container footer-grid">
          <div>
            <h3>${CONFIG.brandName}</h3>
            <p>Phone: ${CONFIG.phone}</p>
            <p>Email: ${CONFIG.email}</p>
            <p>Address: ${CONFIG.address}</p>
          </div>
          <div>
            <h3>Useful Links</h3>
            <a href="/privacy.html">Privacy Policy</a>
            <a href="/terms.html">Terms &amp; Conditions</a>
          </div>
          <div>
            <h3>Follow Us</h3>
            <div class="social">
              <a href="${CONFIG.social.facebook}" target="_blank" rel="noopener">Facebook</a>
              <a href="${CONFIG.social.instagram}" target="_blank" rel="noopener">Instagram</a>
              <a href="${CONFIG.social.tiktok}" target="_blank" rel="noopener">TikTok</a>
            </div>
          </div>
        </div>
        <div class="footer-bottom">&copy; ${new Date().getFullYear()} ${CONFIG.brandName}. All rights reserved.</div>
      </footer>`;
  }

  // ===== Cart drawer =====
  let renderToken = 0;

  function isDrawerOpen() {
    return document.getElementById('cart-drawer').classList.contains('open');
  }

  function openCart() {
    document.getElementById('cart-drawer').classList.add('open');
    document.getElementById('cart-drawer').setAttribute('aria-hidden', 'false');
    document.getElementById('drawer-overlay').classList.add('open');
    document.body.classList.add('no-scroll');
    renderCart();
  }

  function closeCart() {
    document.getElementById('cart-drawer').classList.remove('open');
    document.getElementById('cart-drawer').setAttribute('aria-hidden', 'true');
    document.getElementById('drawer-overlay').classList.remove('open');
    document.body.classList.remove('no-scroll');
  }

  function updateBadge() {
    document.getElementById('cart-count').textContent = PicasoCart.count();
  }

  function setSummary(subtotal, note) {
    document.getElementById('cart-subtotal').textContent = money(subtotal);
    document.getElementById('cart-note').textContent = note || '';
  }

  function qtyButton(label, onClick, disabled) {
    return el('button', { type: 'button', class: 'qty-btn', onclick: onClick, disabled }, label);
  }

  function lineElement(line) {
    return el('div', { class: 'cart-line' }, [
      el('div', {}, [
        el('div', { class: 'cart-line-title' }, line.title),
        el('div', { class: 'cart-line-price' }, `${money(line.unitPrice)} each`)
      ]),
      el('div', { class: 'cart-line-side' }, [
        el('div', { class: 'qty' }, [
          qtyButton('\u2212', () => PicasoCart.changeQuantity(line.productId, -1), line.quantity <= 1),
          el('span', {}, String(line.quantity)),
          qtyButton('+', () => PicasoCart.changeQuantity(line.productId, 1), false)
        ]),
        el('div', { class: 'cart-line-total' }, money(line.lineTotal)),
        el('button', { type: 'button', class: 'link-btn', onclick: () => PicasoCart.remove(line.productId) }, 'Remove')
      ])
    ]);
  }

  async function renderCart() {
    const body = document.getElementById('cart-body');
    const checkout = document.getElementById('cart-checkout');
    const token = ++renderToken;

    if (PicasoCart.get().length === 0) {
      body.replaceChildren(el('div', { class: 'drawer-empty' }, 'Your cart is empty.'));
      setSummary(0, '');
      checkout.setAttribute('aria-disabled', 'true');
      checkout.style.pointerEvents = 'none';
      checkout.style.opacity = '0.4';
      return;
    }

    checkout.removeAttribute('aria-disabled');
    checkout.style.pointerEvents = '';
    checkout.style.opacity = '';
    body.replaceChildren(el('div', { class: 'drawer-loading' }, 'Updating cart...'));

    try {
      const data = await PicasoCart.calculate(false);
      if (token !== renderToken) return; // a newer render has started
      if (!data.ok) throw new Error(data.message || 'Cart error');

      body.replaceChildren(...data.items.map(lineElement));
      const upsell = data.upsells && data.upsells[0] ? data.upsells[0].message : '';
      setSummary(data.subtotal, upsell);
    } catch (err) {
      if (token !== renderToken) return;
      body.replaceChildren(el('div', { class: 'drawer-empty' }, 'Could not load the cart. Please try again.'));
    }
  }

  // ===== Build layout =====
  function buildLayout() {
    document.body.insertAdjacentHTML('afterbegin', headerHTML());
    document.body.insertAdjacentHTML('beforeend', footerHTML() + drawerHTML());

    // Highlight the current page in the nav
    const path = window.location.pathname;
    document.querySelectorAll('.site-nav a').forEach(a => {
      const href = a.getAttribute('href');
      if (href === path || (href === '/' && path === '/index.html')) {
        a.classList.add('active');
      }
    });

    document.getElementById('cart-open').addEventListener('click', openCart);
    document.getElementById('cart-close').addEventListener('click', closeCart);
    document.getElementById('drawer-overlay').addEventListener('click', closeCart);

    document.getElementById('menu-toggle').addEventListener('click', () => {
      const nav = document.getElementById('site-nav');
      const isOpen = nav.classList.toggle('open');
      document.getElementById('menu-toggle').setAttribute('aria-expanded', String(isOpen));
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && isDrawerOpen()) closeCart();
    });

    window.addEventListener('cart:changed', () => {
      updateBadge();
      if (isDrawerOpen()) renderCart();
    });

    updateBadge();
  }

  buildLayout();

  // Pages call these after adding to cart, e.g. PicasoLayout.openCart()
  window.PicasoLayout = { openCart, closeCart, renderCart };
})();