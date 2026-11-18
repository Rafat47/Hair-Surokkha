// All prices are calculated on the server.
// The browser sends only product categories and quantities.

const Product = require('../models/Product');
const Settings = require('../models/Settings');

async function getSettings() {
  let settings = await Settings.findOne({ key: 'main' });
  if (!settings) {
    settings = await Settings.create({ key: 'main' });
  }
  return settings;
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

// Input: [{ category: 'minoxidil' | 'roller', quantity: number }]
// Output: full cart breakdown with items, subtotal, delivery and total.
async function calculateCart(cartItems, isInsideDhaka) {
  const settings = await getSettings();

  const [minoxidil, roller] = await Promise.all([
    Product.findOne({ category: 'minoxidil', isActive: true }),
    Product.findOne({ category: 'roller', isActive: true })
  ]);

  let minoxidilQty = 0;
  let rollerQty = 0;

  for (const item of cartItems || []) {
    const qty = Math.max(0, parseInt(item.quantity, 10) || 0);
    if (item.category === 'minoxidil') minoxidilQty += qty;
    if (item.category === 'roller') rollerQty += qty;
  }

  const items = [];

  if (minoxidilQty > 0 && minoxidil) {
    const lineTotal = minoxidilTotal(minoxidilQty, minoxidil, settings);
    items.push({
      category: 'minoxidil',
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
      title: roller.title,
      quantity: rollerQty,
      unitPrice,
      lineTotal: rollerTotal(rollerQty, roller, hasMinoxidil)
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
  offerPercent,
  minoxidilTotal,
  rollerTotal,
  deliveryFor
};