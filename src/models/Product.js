const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    category: { type: String, required: true, trim: true, maxlength: 40 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    images: { type: [String], default: [] },
    regularPrice: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, required: true, min: 0 },
    // Optional. null means this product has no bundle price.
    bundlePrice: { type: Number, default: null, min: 0 },
    isActive: { type: Boolean, required: true, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);