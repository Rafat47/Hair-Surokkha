const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    category: { type: String, required: true, trim: true, maxlength: 40 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    images: { type: [String], default: [] },
    regularPrice: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, required: true, min: 0 },
    // Key of a file in src/business/logics (for example "none", "bundle-price")
    businessLogic: { type: String, required: true, default: 'none' },
    // Values for that logic, for example { bundlePrice: 190 } or { twoPrice: 1600, threePrice: 2400 }
    logicValues: { type: mongoose.Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, required: true, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);