const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    // 'minoxidil' or 'roller'. Pricing rules depend on this.
    category: {
      type: String,
      enum: ['minoxidil', 'roller'],
      required: true,
      unique: true
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

module.exports = mongoose.model('Product', productSchema);