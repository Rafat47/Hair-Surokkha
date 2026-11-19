// Creates the two starter products and the settings document, but only when the
// products collection is empty. Existing data is never overwritten.

const Product = require('../models/Product');
const Settings = require('../models/Settings');

async function seedDefaults() {
  const count = await Product.countDocuments();

  if (count === 0) {
    await Product.insertMany([
      {
        category: 'minoxidil',
        title: 'Kirkland Minoxidil 5% Solution',
        description: 'Starter product. Edit this description in the admin Products page.',
        images: [],
        regularPrice: 1000,
        salePrice: 830,
        businessLogic: 'quantity-pricing',
        logicValues: { twoPrice: 1600, threePrice: 2400 },
        isActive: true
      },
      {
        category: 'roller',
        title: 'Derma Roller',
        description: 'Starter product. Edit this description in the admin Products page.',
        images: [],
        regularPrice: 280,
        salePrice: 230,
        businessLogic: 'bundle-price',
        logicValues: { bundlePrice: 190 },
        isActive: true
      }
    ]);
    console.log('Starter products added (database was empty)');
  }

  await Settings.updateOne(
    { key: 'main' },
    { $setOnInsert: { key: 'main' } },
    { upsert: true }
  );
}

module.exports = { seedDefaults };