// Bundle price: when the cart also has another product, this product is charged the bundle price.
// Also suggested to customers who have other products in the cart.

const { toNumber } = require('../helpers');

module.exports = {
  key: 'bundle-price',
  label: 'Bundle price (cheaper when bought with another product)',
  fields: [
    { name: 'bundlePrice', label: 'Bundle price, Tk' }
  ],

  validate(input, product) {
    const errors = {};
    const raw = String(input.bundlePrice == null ? '' : input.bundlePrice).trim();
    const bundle = toNumber(raw);

    if (raw === '' || !Number.isFinite(bundle) || bundle < 0) {
      errors.bundlePrice = 'Enter a bundle price';
    } else if (Number.isFinite(product.salePrice) && bundle > product.salePrice) {
      errors.bundlePrice = 'Bundle price cannot be higher than sale price';
    }

    return {
      errors,
      values: Object.keys(errors).length ? {} : { bundlePrice: bundle }
    };
  },

  priceLine({ product, quantity, values, othersInCart }) {
    const useBundle = othersInCart && values.bundlePrice != null;
    const unitPrice = useBundle ? values.bundlePrice : product.salePrice;
    return { unitPrice, lineTotal: unitPrice * quantity };
  },

  // Percentage shown in the upsell message
  offerPercent(product, values) {
    if (values.bundlePrice == null || !product.salePrice) return 0;
    return Math.round(((product.salePrice - values.bundlePrice) / product.salePrice) * 100);
  }
};