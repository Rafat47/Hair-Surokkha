// All prices are calculated on the server.
// The browser sends only product IDs (or 'minoxidil' / 'roller') and quantities.

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

// Products added from the admin panel have no special bundle rules:
// quantity times salePrice, with regularPrice kept for display.
function otherTotal(quantity, product) {
  return product.salePrice * quantity;
}

// Minoxidil price for a given quantity.
// 1 piece = salePrice, 2 pieces = 2-piece price, 3 pieces = 3-piece price,
// every piece after 3 = salePrice added to the 3-piece price.
function minoxidilTotal(quantity, minoxidilProduct, settings) {
  const unit = minoxidilProduct.salePrice;
  if (quantity <= 0) return 0;
  if (quantity === 1) return unit;
  if (quantity === 2) return settings.minoxidilTwoPiecePrice;
  return settings.minoxidilThreePiecePrice + (quantity - 3) * unit;
}

// Roller price: bundlePrice when minoxidil is in the cart, otherwise salePrice.
function rollerTotal(quantity, rollerProduct, hasMinoxidil) {
  if (quantity <= 0) return 0;
  const unit = hasMinoxidil && rollerProduct.bundlePrice != null
    ? rollerProduct.bundlePrice
    : rollerProduct.salePrice;
  return unit * quantity;
}

// Discount percentage shown in upsells.
// x = ((regular_price - sale_price) / regular_price) * 100
// Roller: base price is salePrice, offer price is bundlePrice.
function offerPercent(product) {
  if (product.category === 'roller' && product.bundlePrice != null) {
    const base = product.salePrice;
    return Math.round(((base - product.bundlePrice) / base) * 100);
  }
  const base = product.regularPrice;
  return Math.round(((base - product.salePrice) / base) * 100);
}

function deliveryFor(minoxidilQty, isInsideDhaka, settings) {
  if (minoxidilQty >= settings.freeDeliveryMinMinoxidil) return 0;
  return isInsideDhaka ? settings.deliveryInsideDhaka : settings.deliveryOutsideDhaka;
}

function upsellFor(minoxidilQty, rollerQty, minoxidil, roller) {
  const suggestions = [];

  if (minoxidilQty > 0 && rollerQty === 0 && roller) {
    suggestions.push({
      category: 'roller',
      message: `Add a derma roller to get ${offerPercent(roller)}% off`
    });
  }

  if (rollerQty > 0 && minoxidilQty === 0 && minoxidil) {
    suggestions.push({
      category: 'minoxidil',
      message: `Add another product to get ${offerPercent(minoxidil)}% off`
    });
  }

  return suggestions;
}

// Cart lines are keyed by product id. For backward compatibility the two
// bundle products can also be sent as the old categories 'minoxidil'/'roller'.
// Input: [{ id | category, quantity }]
// Output: full cart breakdown with items, subtotal, delivery and total.
async function calculateCart(cartItems, isInsideDhaka) {
  const settings = await getSettings();

  // Merge quantities per key first, then load every product once.
  const wanted = new Map();
  for (const item of cartItems || []) {
    const qty = Math.max(0, parseInt(item.quantity, 10) || 0);
    if (!qty) continue;

    let key = String(item.id || '').trim();
    if (!mongoose.Types.ObjectId.isValid(key)) {
      // Old format: category name instead of an id
      if (item.category === 'minoxidil' || item.category === 'roller') {
        key = `category:${item.category}`;
      } else {
        continue;
      }
    }
    wanted.set(key, (wanted.get(key) || 0) + qty);
  }

  const ids = [...wanted.keys()].filter(k => !k.startsWith('category:'));
  const categories = [...wanted.keys()].filter(k => k.startsWith('category:'))
    .map(k => k.slice('category:'.length));

  const found = await Product.find({
    isActive: true,
    $or: [
      ids.length ? { _id: { $in: ids } } : null,
      categories.length ? { category: { $in: categories } } : null
    ].filter(Boolean)
  }).lean();

  // Resolve the legacy category keys to real documents
  for (const doc of found) {
    const legacyKey = `category:${doc.category}`;
    if (wanted.has(legacyKey) && (doc.category === 'minoxidil' || doc.category === 'roller')) {
      const extra = wanted.get(legacyKey);
      wanted.delete(legacyKey);
      wanted.set(String(doc._id), (wanted.get(String(doc._id)) || 0) + extra);
    }
  }

  let minoxidil = null;
  let roller = null;
  const others = [];

  for (const doc of found) {
    if (!wanted.has(String(doc._id))) continue;
    if (doc.category === 'minoxidil') minoxidil = doc;
    else if (doc.category === 'roller') roller = doc;
    else others.push(doc);
  }

  const minoxidilQty = minoxidil ? (wanted.get(String(minoxidil._id)) || 0) : 0;
  const rollerQty = roller ? (wanted.get(String(roller._id)) || 0) : 0;

  const items = [];

  if (minoxidilQty > 0 && minoxidil) {
    const lineTotal = minoxidilTotal(minoxidilQty, minoxidil, settings);
    items.push({
      category: 'minoxidil',
      productId: minoxidil._id,
      title: minoxidil.title,
      quantity: minoxidilQty,
      unitPrice: Math.round(lineTotal / minoxidilQty),
      lineTotal
    });
  }

  if (rollerQty > 0 && roller) {
    const hasMinoxidil = minoxidilQty > 0;
    const unitPrice = hasMinoxidil && roller.bundlePrice != null
      ? roller.bundlePrice
      : roller.salePrice;
    items.push({
      category: 'roller',
      productId: roller._id,
      title: roller.title,
      quantity: rollerQty,
      unitPrice,
      lineTotal: rollerTotal(rollerQty, roller, hasMinoxidil)
    });
  }

  for (const product of others) {
    const qty = wanted.get(String(product._id)) || 0;
    if (qty <= 0) continue;
    const lineTotal = otherTotal(qty, product);
    items.push({
      category: 'other',
      productId: product._id,
      title: product.title,
      quantity: qty,
      unitPrice: product.salePrice,
      lineTotal
    });
  }

  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
  const deliveryCharge = items.length
    ? deliveryFor(minoxidilQty, isInsideDhaka, settings)
    : 0;

  return {
    items,
    subtotal,
    deliveryCharge,
    total: subtotal + deliveryCharge,
    isFreeDelivery: items.length > 0 && deliveryCharge === 0,
    upsells: upsellFor(minoxidilQty, rollerQty, minoxidil, roller),
    currency: settings.currency
  };
}

module.exports = {
  getSettings,
  calculateCart,
  otherTotal,
  offerPercent,
  minoxidilTotal,
  rollerTotal,
  deliveryFor
};