// Cart totals. The product rules live in src/business, so this file has no product-specific logic.

const Settings = require('../models/Settings');
const productStore = require('./productStore');
const business = require('../business');

const MAX_QTY_PER_PRODUCT = 99;

async function getSettings() {
  let settings = await Settings.findOne({ key: 'main' });
  if (!settings) {
    settings = await Settings.create({ key: 'main' });
  }
  return settings;
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

  // Only active products that still exist are charged
  const entries = [];
  for (const [id, quantity] of quantities) {
    const product = productStore.getActiveById(id);
    if (product) entries.push({ product, quantity });
  }

  const priced = business.priceCart(entries, productStore.getActive());

  // Free delivery uses the quantity from logics that count toward it (set in Settings)
  const isFreeDelivery = priced.items.length > 0 &&
    priced.freeDeliveryQty >= settings.freeDeliveryMinMinoxidil;

  let deliveryCharge = 0;
  if (priced.items.length > 0 && !isFreeDelivery) {
    deliveryCharge = isInsideDhaka ? settings.deliveryInsideDhaka : settings.deliveryOutsideDhaka;
  }

  return {
    items: priced.items,
    subtotal: priced.subtotal,
    deliveryCharge,
    total: priced.subtotal + deliveryCharge,
    isFreeDelivery,
    upsells: priced.suggestions,
    currency: settings.currency
  };
}

module.exports = { getSettings, calculateCart };