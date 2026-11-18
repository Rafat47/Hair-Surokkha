// 1x - 2x - 3x price: 1 unit = sale price, 2 units = 2x total, 3 units = 3x total.
// Each unit after 3 adds the sale price.
// Products with this logic count toward the free-delivery quantity in Settings.

const { toNumber } = require('../helpers');

module.exports = {
    key: 'quantity-pricing',
    label: '1x - 2x - 3x price (quantity pricing)',
    fields: [
        { name: 'twoPrice', label: '2x total price, Tk' },
        { name: 'threePrice', label: '3x total price, Tk' }
    ],
    countsForFreeDelivery: true,

    validate(input) {
        const errors = {};
        const two = toNumber(input.twoPrice);
        const three = toNumber(input.threePrice);

        if (!Number.isFinite(two) || two < 0) errors.twoPrice = 'Enter the 2x total price';
        if (!Number.isFinite(three) || three < 0) errors.threePrice = 'Enter the 3x total price';

        return {
            errors,
            values: Object.keys(errors).length ? {} : { twoPrice: two, threePrice: three }
        };
    },

    priceLine({ product, quantity, values }) {
        const s = product.salePrice;
        let lineTotal;

        if (quantity === 1) lineTotal = s;
        else if (quantity === 2) lineTotal = values.twoPrice;
        else lineTotal = values.threePrice + (quantity - 3) * s;

        return { unitPrice: Math.round(lineTotal / quantity), lineTotal };
    }
};