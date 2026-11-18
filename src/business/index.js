// Business logic registry.
// Each file in ./logics is one business logic. To add one, create a new file there.
// To change one, edit its file. Products refer to a logic by its key.
// A product with an unknown or missing key is charged its sale price.

const fs = require('fs');
const path = require('path');

const LOGIC_DIR = path.join(__dirname, 'logics');
const NONE = 'none';
const logics = {};

for (const file of fs.readdirSync(LOGIC_DIR).sort()) {
  if (!file.endsWith('.js')) continue;
  try {
    const logic = require(path.join(LOGIC_DIR, file));
    if (!logic || typeof logic.key !== 'string' || typeof logic.validate !== 'function' || typeof logic.priceLine !== 'function') {
      throw new Error('must export key, validate() and priceLine()');
    }
    logics[logic.key] = logic;
  } catch (err) {
    console.error(`Business logic "${file}" skipped: ${err.message}`);
  }
}

if (!logics[NONE]) {
  throw new Error('src/business/logics/none.js is required');
}

// For the admin dropdown. "No business logic" is always first.
function listLogics() {
  return Object.values(logics)
    .map(logic => ({ key: logic.key, label: logic.label, fields: logic.fields || [] }))
    .sort((a, b) => {
      if (a.key === NONE) return -1;
      if (b.key === NONE) return 1;
      return a.label.localeCompare(b.label);
    });
}

function hasLogic(key) {
  return Boolean(logics[key]);
}

// Checks the admin form values for one logic.
// Returns { errors, values }. Unknown keys return an error.
function validateLogic(key, input, product) {
  if (!logics[key]) {
    return { errors: { businessLogic: 'Choose a business logic from the list' }, values: {} };
  }
  return logics[key].validate(input && typeof input === 'object' ? input : {}, product);
}

// entries: [{ product, quantity }]. Products are plain objects from productStore.
// catalog: all active products, used for upsell suggestions.
function priceCart(entries, catalog = []) {
  const lines = (entries || []).filter(e => e.product && e.quantity > 0);
  const othersInCart = lines.length > 1;
  const warnings = [];

  const items = lines.map(({ product, quantity }) => {
    let logic = logics[product.businessLogic];
    if (!logic) {
      if (product.businessLogic) {
        warnings.push(`"${product.title}" uses unknown business logic "${product.businessLogic}". Sale price used.`);
      }
      logic = logics[NONE];
    }

    const priced = logic.priceLine({
      product,
      quantity,
      values: product.logicValues || {},
      othersInCart
    });

    return {
      productId: String(product._id),
      title: product.title,
      quantity,
      unitPrice: priced.unitPrice,
      lineTotal: priced.lineTotal,
      businessLogic: logic.key
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

  // Quantity from logics that count toward free delivery
  const freeDeliveryQty = items
    .filter(item => logics[item.businessLogic].countsForFreeDelivery === true)
    .reduce((sum, item) => sum + item.quantity, 0);

  // Upsell: one product not in the cart whose logic offers a discount
  const suggestions = [];
  const cartIds = new Set(lines.map(l => String(l.product._id)));
  if (cartIds.size) {
    for (const product of catalog) {
      if (suggestions.length >= 1) break;
      if (cartIds.has(String(product._id))) continue;

      const logic = logics[product.businessLogic];
      if (!logic || typeof logic.offerPercent !== 'function') continue;

      const pct = logic.offerPercent(product, product.logicValues || {});
      if (!(pct > 0)) continue;

      suggestions.push({
        productId: String(product._id),
        message: `Add ${product.title} to get ${pct}% off`
      });
    }
  }

  return { items, subtotal, freeDeliveryQty, suggestions, warnings };
}

module.exports = { listLogics, hasLogic, validateLogic, priceCart };