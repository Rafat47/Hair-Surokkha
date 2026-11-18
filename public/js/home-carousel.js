// Home page product carousel.
// Loads every available (active) product from /api/products, renders one card
// per product, and auto-scrolls the cards from left to right (right to left).
// The Buy button adds the product to the cart and goes straight to checkout.

(function () {
  const CURRENCY = 'BDT';
  const AUTOPLAY_MS = 3500;   // pause between slides
  const SCROLL_MS = 650;      // slide animation duration
  const GAP = 20;             // must match --carousel-gap in home.css

  const track = document.getElementById('carousel-track');
  const dotsBox = document.getElementById('carousel-dots');
  const prevBtn = document.querySelector('.carousel-prev');
  const nextBtn = document.querySelector('.carousel-next');
  if (!track) return;

  let cards = [];
  let index = 0;
  let timer = null;

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

  function shortDescription(text) {
    const clean = (text || '').trim();
    if (!clean) return '';
    return clean.length > 110 ? clean.slice(0, 107).trimEnd() + '\u2026' : clean;
  }

  function buildCard(product) {
    const imageBox = el('div', { class: 'carousel-card-image' },
      product.images && product.images[0]
        ? [el('img', { src: product.images[0], alt: product.title, loading: 'lazy' })]
        : []
    );

    const priceRow = el('div', { class: 'carousel-card-price' }, [
      el('span', { class: 'price-regular' }, money(product.regularPrice)),
      el('span', { class: 'price-sale' }, money(product.salePrice))
    ]);

    // Buy button sits in the right corner of the card footer
    const buyBtn = el('button', {
      type: 'button',
      class: 'btn btn-primary carousel-buy',
      onclick: () => {
        PicasoCart.add(product._id, 1);
        if (window.PicasoTracking) {
          PicasoTracking.track('AddToCart', {
            content_ids: [product._id],
            content_type: 'product',
            content_name: product.title,
            value: product.salePrice,
            currency: CURRENCY,
            num_items: 1
          });
        }
        window.location.href = '/checkout.html';
      }
    }, 'Buy');

    const footer = el('div', { class: 'carousel-card-footer' }, [
      el('a', { class: 'carousel-card-link', href: `/product.html?id=${encodeURIComponent(product._id)}` }, 'Details'),
      buyBtn
    ]);

    return el('article', { class: 'carousel-card' }, [
      imageBox,
      el('div', { class: 'carousel-card-body' }, [
        el('h3', { class: 'carousel-card-title' }, product.title),
        el('p', { class: 'carousel-card-desc' }, shortDescription(product.description)),
        priceRow
      ]),
      footer
    ]);
  }

  function cardStep() {
    if (!cards.length) return 0;
    return cards[0].getBoundingClientRect().width + GAP;
  }

  function maxIndex() {
    if (!cards.length) return 0;
    // How many cards fit fully in the viewport at once
    const visible = Math.max(1, Math.floor((track.parentElement.clientWidth + GAP) / cardStep()));
    return Math.max(0, cards.length - visible);
  }

  function renderDots() {
    if (!dotsBox) return;
    const pages = maxIndex() + 1;
    if (pages <= 1) {
      dotsBox.replaceChildren();
      return;
    }
    const dots = [];
    for (let i = 0; i < pages; i++) {
      dots.push(el('button', {
        type: 'button',
        class: 'carousel-dot' + (i === index ? ' active' : ''),
        'aria-label': `Go to slide ${i + 1}`,
        onclick: () => goTo(i, true)
      }));
    }
    dotsBox.replaceChildren(...dots);
  }

  function applyPosition(animate) {
    const offset = -(index * cardStep());
    track.style.transition = animate ? `transform ${SCROLL_MS}ms ease` : 'none';
    track.style.transform = `translateX(${offset}px)`;
    renderDots();
  }

  function goTo(next, userAction) {
    const max = maxIndex();
    index = next < 0 ? max : (next > max ? 0 : next);
    applyPosition(true);
    if (userAction) restartAutoplay();
  }

  function startAutoplay() {
    stopAutoplay();
    if (cards.length <= 1) return;
    timer = setInterval(() => goTo(index + 1, false), AUTOPLAY_MS);
  }

  function stopAutoplay() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function restartAutoplay() {
    stopAutoplay();
    startAutoplay();
  }

  function showStatus(message) {
    track.replaceChildren(el('div', { class: 'carousel-status' }, message));
    if (dotsBox) dotsBox.replaceChildren();
  }

  async function init() {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || 'Could not load products');

      if (!data.products.length) {
        showStatus('No products are available right now.');
        return;
      }

      cards = data.products.map(buildCard);
      track.replaceChildren(...cards);
      index = 0;
      applyPosition(false);
      startAutoplay();
    } catch (err) {
      showStatus('Could not load products. Please refresh the page.');
    }
  }

  if (prevBtn) prevBtn.addEventListener('click', () => goTo(index - 1, true));
  if (nextBtn) nextBtn.addEventListener('click', () => goTo(index + 1, true));

  const carousel = document.getElementById('product-carousel');
  if (carousel) {
    carousel.addEventListener('mouseenter', stopAutoplay);
    carousel.addEventListener('mouseleave', startAutoplay);
  }

  window.addEventListener('resize', () => {
    if (!cards.length) return;
    if (index > maxIndex()) index = maxIndex();
    applyPosition(false);
  });

  init();
})();
