// Pricing for the whole cart. Works for any product.
//
// 1. A product is charged its sale price.
// 2. Bundle price (optional, per product): if the cart also holds a different product,
//    each unit of this product is charged the bundle price.
// 3. Products in the "minoxidil" category use the quantity prices in Settings:
//    2 bottles total, 3 bottles total, and each extra bottle at the sale price.
// 4. Delivery is free when the cart has enough minoxidil bottles (Settings).

const Settings = require('../models/Settings');
const productStore = require('./productStore');

const MINOXIDIL = 'minoxidil';
const MAX_QTY_PER_PRODUCT = 99;
const MAX_SUGGESTIONS = 1;

async function getSettings() {
  let settings = await Settings.findOne({ key: 'main' });
  if (!settings) {
    settings = await Settings.create({ key: 'main' });
  }
  return settings;
}

function minoxidilTotal(quantity, salePrice, settings) {
  if (quantity === 1) return salePrice;
  if (quantity === 2) return settings.minoxidilTwoPiecePrice;
  return settings.minoxidilThreePiecePrice + (quantity - 3) * salePrice;
}

// product: database product, quantity: total quantity in cart,
// picked: all distinct products in the cart (used for the bundle rule)
function priceLine(product, quantity, picked, settings) {
  if (product.category === MINOXIDIL) {
    const lineTotal = minoxidilTotal(quantity, product.salePrice, settings);
    return { unitPrice: Math.round(lineTotal / quantity), lineTotal };
  }

  const bundled = product.bundlePrice != null && picked.length > 1;
  const unitPrice = bundled ? product.bundlePrice : product.salePrice;
  return { unitPrice, lineTotal: unitPrice * quantity };
}

// Suggests one product that has a bundle price and is not in the cart yet.
function suggestionsFor(cartIds, catalog) {
  const suggestions = [];
  if (cartIds.size === 0) return suggestions;

  for (const product of catalog) {
    if (suggestions.length >= MAX_SUGGESTIONS) break;
    if (cartIds.has(product._id)) continue;
    if (product.category === MINOXIDIL) continue;
    if (product.bundlePrice == null || !product.salePrice) continue;

    const pct = Math.round(((product.salePrice - product.bundlePrice) / product.salePrice) * 100);
    if (pct <= 0) continue;

    suggestions.push({
      productId: product._id,
      message: `Add ${product.title} to get ${pct}% off`
    });
  }
  return suggestions;
}

// cartItems: [{ productId, quantity }]
async function calculateCart(cartItems, isInsideDhaka) {
  const settings = await getSettings();

  // Merge repeated product IDs and clean quantities
  const quantities = new Map();
  for (const item of cartItems || []) {
    const id = String((item && item.productId) || '');
    const qty = Math.max(0, parseInt(item && item.quantity, 10) || 0);
    if (!id || !qty) continue;
    quantities.set(id, Math.min(MAX_QTY_PER_PRODUCT, (quantities.get(id) || 0) + qty));
  }

  // Only active products that exist are charged
  const picked = [];
  for (const [id, quantity] of quantities) {
    const product = productStore.getActiveById(id);
    if (product) picked.push({ product, quantity });
  }

  const items = picked.map(({ product, quantity }) => {
    const priced = priceLine(product, quantity, picked, settings);
    return {
      productId: product._id,
      category: product.category,
      title: product.title,
      quantity,
      unitPrice: priced.unitPrice,
      lineTotal: priced.lineTotal
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

  const minoxidilQty = items
    .filter(item => item.category === MINOXIDIL)
    .reduce((sum, item) => sum + item.quantity, 0);

  const isFreeDelivery = items.length > 0 && minoxidilQty >= settings.freeDeliveryMinMinoxidil;

  let deliveryCharge = 0;
  if (items.length > 0 && !isFreeDelivery) {
    deliveryCharge = isInsideDhaka ? settings.deliveryInsideDhaka : settings.deliveryOutsideDhaka;
  }

  const cartIds = new Set(picked.map(p => p.product._id));
  const upsells = suggestionsFor(cartIds, productStore.getActive());

  return {
    items,
    subtotal,
    deliveryCharge,
    total: subtotal + deliveryCharge,
    isFreeDelivery,
    upsells,
    currency: settings.currency
  };
}

module.exports = { getSettings, calculateCart };