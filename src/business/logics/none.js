// No business logic: the customer pays the sale price.
// Keep this file. Products without a logic use it.

module.exports = {
  key: 'none',
  label: 'No business logic (sale price)',
  fields: [],

  validate() {
    return { errors: {}, values: {} };
  },

  priceLine({ product, quantity }) {
    return {
      unitPrice: product.salePrice,
      lineTotal: product.salePrice * quantity
    };
  }
};