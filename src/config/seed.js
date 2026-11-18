// Creates the two products and the settings document on first start.
// Existing data is never overwritten, so changes made in the admin panel are kept.

const Product = require('../models/Product');
const Settings = require('../models/Settings');

async function seedDefaults() {
  await Product.updateOne(
    { category: 'minoxidil' },
    {
      $setOnInsert: {
        category: 'minoxidil',
        title: 'Kirkland Minoxidil 5% Solution',
        description: '',
        images: [],
        // PLACEHOLDER: replace with the real crossed-out price (see admin panel)
        regularPrice: 1000,
        salePrice: 830,
        bundlePrice: null,
        isActive: true
      }
    },
    { upsert: true }
  );

  await Product.updateOne(
    { category: 'roller' },
    {
      $setOnInsert: {
        category: 'roller',
        title: 'Derma Roller',
        description: '',
        images: [],
        // PLACEHOLDER: replace with the real crossed-out price (see admin panel)
        regularPrice: 280,
        salePrice: 230,
        bundlePrice: 190,
        isActive: true
      }
    },
    { upsert: true }
  );

  await Settings.updateOne(
    { key: 'main' },
    { $setOnInsert: { key: 'main' } },
    { upsert: true }
  );

  console.log('Default products and settings are ready');
}

module.exports = { seedDefaults };