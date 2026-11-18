// All prices are calculated on the server.
// The browser sends only product ids and quantities.

const mongoose = require('mongoose');
const Product = require('../models/Product');
const Settings = require('../models/Settings');

async function getSettings() {
  let settings = await Settings.findOne({ key: 'main' });
  if (!settings) {
    settings = await Settings.create({ key: 'main' });
  }
  return settings;
}

// Price for one piece of a normal product, with simple quantity tiers:
// qty >= tier2 -> tier2 price per piece, qty >= tier3 -> tier3 price per piece.
// Tiers are only used when they make sense (tier3 <= tier2 <= salePrice).
function unitPriceFor(product, quantity, settings) {
  const sale = product.salePrice;
  const tier2 = settings.minoxidilTwoPiecePrice;
  const tier3 = settings.minoxidilThreePiecePrice;

  if (quantity >= 3 && Number.isFinite(tier3) && tier3 > 0 && tier3 <= tier2 && tier2 <= sale) {
    return tier3;
  }
  if (quantity >= 2 && Number.isFinite(tier2) && tier2 > 0 && tier2 <= sale) {
    return tier2;
  }
  return sale;
}

// Bundle price applies when this product is in the cart together with any
// other product that has its own bundlePrice (e.g. roller + minoxidil).
function bundleUnitPrice(product, othersInCart) {
  if (product.bundlePrice == null) return null;
  const partner = othersInCart.find(p => p._id.toString() !== product._id.toString());
  return partner ? product.bundlePrice : null;
}

// Discount percentage shown in upsells.
// With bundle: base price is salePrice, offer price is bundlePrice.
// Without bundle: base price is regularPrice.
function offerPercent(product) {
  const base = product.bundlePrice != null ? product.salePrice : product.regularPrice;
  const offer = product.bundlePrice != null ? product.bundlePrice : product.salePrice;
  if (!(base > 0)) return 0;
  return Math.round(((base - offer) / base) * 100);
}

function deliveryFor(totalQuantity, isInsideDhaka, settings) {
  if (totalQuantity >= settings.freeDeliveryMinMinoxidil) return 0;
  return isInsideDhaka ? settings.deliveryInsideDhaka : settings.deliveryOutsideDhaka;
}

// Input: [{ id: '<product id>', quantity: number }]
// Output: full cart breakdown with items, subtotal, delivery and total.
async function calculateCart(cartItems, isInsideDhaka) {
  const settings = await getSettings();

  // Collect quantities per valid product id
  const wanted = new Map();
  for (const item of cartItems || []) {
    const rawId = String(item.id || item.category || '').trim();
    if (!mongoose.Types.ObjectId.isValid(rawId)) continue;
    const qty = Math.min(Math.max(parseInt(item.quantity, 10) || 0, 0), 99);
    if (qty <= 0) continue;
    const key = rawId.toLowerCase();
    wanted.set(key, (wanted.get(key) || 0) + qty);
  }

  const products = await Product.find({ isActive: true }).lean();

  const items = [];
  const inCart = [];

  for (const p of products) {
    const qty = wanted.get(p._id.toString()) || 0;
    if (qty <= 0) continue;
    inCart.push(p);
  }

  for (const product of inCart) {
    const qty = wanted.get(product._id.toString());
    const bundle = bundleUnitPrice(product, inCart);
    const unit = bundle != null ? bundle : unitPriceFor(product, qty, settings);
    const lineTotal = unit * qty;

    items.push({
      category: product._id.toString(),
      title: product.title,
      quantity: qty,
      unitPrice: Math.round(lineTotal / qty),
      lineTotal
    });
  }

  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
  const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);
  const deliveryCharge = items.length
    ? deliveryFor(totalQuantity, isInsideDhaka, settings)
    : 0;

  // Upsells: suggest up to 2 active products that are not in the cart yet.
  const upsells = [];
  const cartIds = new Set(inCart.map(p => p._id.toString()));
  const outside = products.filter(p => !cartIds.has(p._id.toString()));

  if (inCart.length && outside.length) {
    const hasBundlePartner = inCart.some(p => p.bundlePrice != null);
    const best = [...outside].sort((a, b) => offerPercent(b) - offerPercent(a))[0];
    const pct = offerPercent(best);
    const message = hasBundlePartner || best.bundlePrice != null
      ? `Add ${best.title} to get ${pct}% off`
      : `Add another product to get ${pct}% off`;
    upsells.push({
      category: best._id.toString(),
      title: best.title,
      message
    });
  }

  return {
    items,
    subtotal,
    deliveryCharge,
    total: subtotal + deliveryCharge,
    isFreeDelivery: items.length > 0 && deliveryCharge === 0,
    upsells,
    currency: settings.currency
  };
}

module.exports = {
  getSettings,
  calculateCart,
  offerPercent,
  unitPriceFor,
  deliveryFor
};
