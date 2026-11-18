// Home page product carousel.
// Loads every available (active) product from /api/products, renders one card
// per product, and auto-scrolls the cards from left to right (right to left).
// Each card is a full-image square that links to the product detail page;
// the product name is shown under the card.
// Supports fast touch swiping with momentum-like flick detection.

(function () {
  const AUTOPLAY_MS = 3500;   // pause between slides
  const SCROLL_MS = 400;      // slide animation duration
  const SNAP_MS = 280;        // snap duration after a finger swipe
  const GAP = 20;             // must match --carousel-gap in home.css

  const carousel = document.getElementById('product-carousel');
  const viewport = document.querySelector('#product-carousel .carousel-viewport');
  const track = document.getElementById('carousel-track');
  const dotsBox = document.getElementById('carousel-dots');
  const prevBtn = document.querySelector('.carousel-prev');
  const nextBtn = document.querySelector('.carousel-next');
  if (!track || !viewport) return;

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

  function buildCard(product) {
    const href = `/product.html?id=${encodeURIComponent(product._id)}`;

    // The whole card is the product image and links to the product page.
    const imageLink = el('a', { class: 'carousel-card-image-link', href }, [
      el('div', { class: 'carousel-card-image' },
        product.images && product.images[0]
          ? [el('img', { src: product.images[0], alt: product.title, loading: 'lazy' })]
          : []
      )
    ]);

    // Product name shown below the card.
    const name = el('a', {
      class: 'carousel-card-name',
      href,
      title: product.title
    }, product.title);

    return el('article', { class: 'carousel-card' }, [imageLink, name]);
  }

  function cardStep() {
    if (!cards.length) return 0;
    return cards[0].getBoundingClientRect().width + GAP;
  }

  function maxIndex() {
    if (!cards.length) return 0;
    // How many cards fit fully in the viewport at once
    const visible = Math.max(1, Math.floor((viewport.clientWidth + GAP) / cardStep()));
    return Math.max(0, cards.length - visible);
  }

  // Extra padding on each side of the track so the first/last card can be
  // scrolled into the centre of the viewport (used on desktop). The CSS sets
  // .carousel-track { padding-left: <half a card> } above 768px; we read it
  // from the element so JS and CSS always match.
  function edgePad() {
    return parseFloat(getComputedStyle(track).paddingLeft) || 0;
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

  function applyPosition(animate, duration) {
    const offset = edgePad() - (index * cardStep());
    track.style.transition = animate ? `transform ${duration || SCROLL_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)` : 'none';
    track.style.transform = `translateX(${offset}px)`;
    renderDots();
  }

  function goTo(next, userAction) {
    const max = maxIndex();
    index = next < 0 ? max : (next > max ? 0 : next);
    applyPosition(true);
    if (userAction) restartAutoplay();
  }

  // ---- Touch / swipe support: drag the track with the finger and snap fast ----
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let startOffset = 0;
  let lastX = 0;
  let lastTime = 0;
  let velocity = 0; // px per ms

  function currentOffset() {
    return edgePad() - (index * cardStep());
  }

  viewport.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    dragging = true;
    moved = false;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startOffset = currentOffset();
    lastX = startX;
    lastTime = e.timeStamp;
    velocity = 0;
    stopAutoplay();
    track.style.transition = 'none';
  }, { passive: true });

  viewport.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;

    if (!moved) {
      const dx = Math.abs(x - startX);
      const dy = Math.abs(y - startY);
      if (dy > dx) {          // vertical scroll intent – don't hijack it
        dragging = false;
        return;
      }
      if (dx > 8) {
        moved = true;
        if (e.cancelable) e.preventDefault(); // take over horizontal panning
      } else {
        return;
      }
    }

    const dt = e.timeStamp - lastTime;
    if (dt > 0) velocity = (x - lastX) / dt;
    lastX = x;
    lastTime = e.timeStamp;

    let offset = startOffset + (x - startX);
    const min = edgePad() - maxIndex() * cardStep(); // fully clamped position
    const maxOff = edgePad();
    // Rubber-band resistance past the ends
    if (offset > maxOff) offset = maxOff + (offset - maxOff) * 0.3;
    else if (offset < min) offset = min + (offset - min) * 0.3;
    track.style.transform = `translateX(${offset}px)`;
  }, { passive: false });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    if (!moved) { restartAutoplay(); return; }

    const step = cardStep();
    const cur = startOffset + (lastX - startX);
    // Project momentum forward for a snappy flick feel
    const projected = cur + velocity * 120;
    let newIndex = Math.round((edgePad() - projected) / step);
    const max = maxIndex();
    newIndex = Math.max(0, Math.min(max, newIndex));
    index = newIndex;
    applyPosition(true, SNAP_MS);
    restartAutoplay();
  }

  viewport.addEventListener('touchend', endDrag);
  viewport.addEventListener('touchcancel', endDrag);

  // Prevent accidental navigation when the user swiped instead of tapped.
  track.addEventListener('click', (e) => {
    if (moved) {
      e.preventDefault();
      e.stopPropagation();
      moved = false;
    }
  }, true);

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
