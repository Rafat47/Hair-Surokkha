const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    // Free text (e.g. 'minoxidil', 'roller'). Products are identified by _id;
    // the id is always unique because MongoDB generates it.
    category: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 40
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

// Remove the old "one product per category" unique index that existed in
// earlier versions. Without this, MongoDB would refuse to add new products.
async function dropLegacyCategoryIndex() {
  try {
    const indexes = await productSchema.collection.indexes();
    const legacy = indexes.find(i => i.unique && i.key && Object.keys(i.key).join(',') === 'category');
    if (legacy) {
      await productSchema.collection.dropIndex(legacy.name);
      console.log('Removed old unique index on product category');
    }
  } catch (err) {
    // Collection may not exist yet; nothing to do.
  }
}

const Product = mongoose.model('Product', productSchema);
Product.dropLegacyCategoryIndex = dropLegacyCategoryIndex;

module.exports = Product;