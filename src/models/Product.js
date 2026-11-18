const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    // 'minoxidil' and 'roller' are the two products with special bundle rules.
    // They may exist only once each. Any product added from the admin panel is
    // stored as 'other' and uses plain prices, so there can be many of them.
    category: {
      type: String,
      enum: ['minoxidil', 'roller', 'other'],
      required: true
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    // Image paths or URLs, shown in the product gallery
    images: { type: [String], default: [] },
    // Crossed-out price shown on the shop
    regularPrice: { type: Number, required: true, min: 0 },
    // Price for one piece (what the customer pays alone)
    salePrice: { type: Number, required: true, min: 0 },
    // Only for the roller: price when bought together with minoxidil (190 Tk)
    bundlePrice: { type: Number, default: null, min: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// Only one product with category 'minoxidil' and one with 'roller'.
// Products added from the admin panel use category 'other' and are unlimited.
productSchema.index(
  { category: 1 },
  { unique: true, partialFilterExpression: { category: { $in: ['minoxidil', 'roller'] } } }
);

module.exports = mongoose.model('Product', productSchema);