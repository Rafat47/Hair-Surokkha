// Product page: loads one product, shows gallery, buy box, description,
// reviews and related products. Fires the browser ViewContent and AddToCart events.

(function () {
  const CURRENCY = 'BDT';
  const productId = new URLSearchParams(window.location.search).get('id');

  let product = null;
  let quantity = 1;

  const $ = id => document.getElementById(id);

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

  function stars(rating) {
    const r = Math.round(rating);
    return '\u2605'.repeat(r) + '\u2606'.repeat(5 - r);
  }

  function formatDate(value) {
    return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function showStatus(message) {
    $('product-status').textContent = message;
    $('product-status').hidden = false;
    $('product-layout').hidden = true;
  }

  // ===== Tracking =====
  function trackViewContent() {
    PicasoTracking.track('ViewContent', {
      content_ids: [product._id],
      content_type: 'product',
      content_name: product.title,
      value: product.salePrice,
      currency: CURRENCY
    });
  }

  function trackAddToCart() {
    PicasoTracking.track('AddToCart', {
      content_ids: [product._id],
      content_type: 'product',
      content_name: product.title,
      value: product.salePrice * quantity,
      currency: CURRENCY,
      num_items: quantity
    });
  }

  // ===== Gallery =====
  function renderGallery() {
    const images = product.images || [];
    const main = $('gallery-main');
    const thumbs = $('gallery-thumbs');

    main.replaceChildren();
    thumbs.replaceChildren();

    if (!images.length) return;

    const mainImg = el('img', { src: images[0], alt: product.title });
    main.append(mainImg);

    if (images.length > 1) {
      images.forEach((src, index) => {
        const thumb = el('button', {
          type: 'button',
          class: 'gallery-thumb' + (index === 0 ? ' active' : ''),
          'aria-label': `Show image ${index + 1}`,
          onclick: () => {
            mainImg.src = src;
            thumbs.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
            thumb.classList.add('active');
          }
        }, [el('img', { src, alt: '', loading: 'lazy' })]);
        thumbs.append(thumb);
      });
    }
  }

  // ===== Buy box =====
  function renderBuyBox() {
    $('product-title').textContent = product.title;
    $('crumb-title').textContent = product.title;
    $('price-regular').textContent = money(product.regularPrice);
    $('price-sale').textContent = money(product.salePrice);

    const bundle = product.logicValues && product.logicValues.bundlePrice;
    if (product.businessLogic === 'bundle-price' && bundle != null) {
      $('price-note').textContent = `${money(bundle)} when bought with another product`;
      $('price-note').hidden = false;
    }

    updateQty();
  }

  function updateQty() {
    $('qty-value').textContent = String(quantity);
    $('qty-minus').disabled = quantity <= 1;
  }

  // ===== Reviews =====
  function reviewCard(review) {
    return el('article', { class: 'review-card' }, [
      el('div', { class: 'review-card-head' }, [
        el('span', { class: 'review-card-name' }, review.name),
        el('span', { class: 'review-card-date' }, formatDate(review.createdAt))
      ]),
      el('div', { class: 'stars', 'aria-label': `${review.rating} out of 5` }, stars(review.rating)),
      el('p', {}, review.comment)
    ]);
  }

  async function loadReviews() {
    try {
      const res = await fetch(`/api/reviews/product/${encodeURIComponent(product._id)}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.message);

      $('summary-stars').textContent = data.count ? stars(data.averageRating) : '';
      $('summary-text').textContent = data.count
        ? `${data.averageRating} out of 5 (${data.count} review${data.count > 1 ? 's' : ''})`
        : 'No reviews yet';

      const list = $('review-list');
      if (!data.reviews.length) {
        list.replaceChildren(el('p', { class: 'review-empty' }, 'Be the first to review this product.'));
      } else {
        list.replaceChildren(...data.reviews.map(reviewCard));
      }
    } catch (err) {
      $('review-list').replaceChildren(el('p', { class: 'review-empty' }, 'Could not load reviews.'));
    }
  }

  function setReviewMessage(text, type) {
    const msg = $('review-message');
    msg.textContent = text;
    msg.className = 'form-message' + (type ? ' ' + type : '');
  }

  function setupReviewForm() {
    $('review-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      const submit = $('review-submit');
      const payload = {
        productId: product._id,
        name: $('review-name').value,
        rating: $('review-rating').value,
        comment: $('review-comment').value
      };

      submit.disabled = true;
      setReviewMessage('Sending...', '');

      try {
        const res = await fetch('/api/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (!data.ok) {
          const firstError = data.errors ? Object.values(data.errors)[0] : data.message;
          setReviewMessage(firstError || 'Could not send review', 'error');
          return;
        }

        $('review-form').reset();
        setReviewMessage('Thank you! Your review has been posted.', 'success');
        await loadReviews();
      } catch (err) {
        setReviewMessage('Network error. Please try again.', 'error');
      } finally {
        submit.disabled = false;
      }
    });
  }

  // ===== Related products =====
  async function loadRelated() {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (!data.ok) return;

      const others = data.products.filter(p => p._id !== product._id);
      if (!others.length) return;

      const cards = others.map(p => {
        const image = p.images && p.images[0]
          ? el('img', { src: p.images[0], alt: p.title, loading: 'lazy' })
          : null;
        return el('article', { class: 'product-card' }, [
          el('div', { class: 'product-image' }, image ? [image] : []),
          el('div', { class: 'product-body' }, [
            el('h3', { class: 'product-title' }, p.title),
            el('div', { class: 'price-row' }, [
              el('span', { class: 'price-regular' }, money(p.regularPrice)),
              el('span', { class: 'price-sale' }, money(p.salePrice))
            ]),
            el('a', { href: `/product.html?id=${encodeURIComponent(p._id)}`, class: 'btn btn-outline btn-block' }, 'View product')
          ])
        ]);
      });

      $('related-grid').replaceChildren(...cards);
      $('related').hidden = false;
    } catch (err) {
      // Related products are optional. Fail silently.
    }
  }

  // ===== Add to Cart / Buy Now =====
  function setupBuyButtons() {
    $('qty-minus').addEventListener('click', () => {
      if (quantity > 1) {
        quantity -= 1;
        updateQty();
      }
    });

    $('qty-plus').addEventListener('click', () => {
      if (quantity < 99) {
        quantity += 1;
        updateQty();
      }
    });

    $('add-to-cart').addEventListener('click', () => {
      PicasoCart.add(product._id, quantity);
      trackAddToCart();
      PicasoLayout.openCart();
    });

    $('buy-now').addEventListener('click', () => {
      PicasoCart.add(product._id, quantity);
      trackAddToCart();
      window.location.href = '/checkout.html';
    });
  }

  // ===== Init =====
  async function init() {
    if (!productId) {
      showStatus('Product not found.');
      return;
    }

    try {
      const res = await fetch(`/api/products/${encodeURIComponent(productId)}`);
      const data = await res.json();
      if (!data.ok) {
        showStatus('Product not found.');
        return;
      }

      product = data.product;
      document.title = `${product.title} | Picaso`;

      renderGallery();
      renderBuyBox();

      $('product-description').textContent = product.description || 'Product details will be added soon.';
      $('product-status').hidden = true;
      $('product-layout').hidden = false;
      $('product-details').hidden = false;
      $('reviews').hidden = false;

      setupBuyButtons();
      setupReviewForm();
      trackViewContent();

      loadReviews();
      loadRelated();
    } catch (err) {
      showStatus('Could not load product. Please refresh the page.');
    }
  }

  init();
})();