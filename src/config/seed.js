const Product = require('../models/Product');
const Settings = require('../models/Settings');

async function seedDefaults() {
  const count = await Product.countDocuments();

  if (count === 0) {
    await Product.insertMany([
      {
        category: 'minoxidil',
        title: 'Kirkland Minoxidil 5% Solution',
        description: '',
        images: [],
        regularPrice: 1000,
        salePrice: 830,
        bundlePrice: 0,
        isActive: true
      },
      {
        category: 'roller',
        title: 'Derma Roller',
        description: '',
        images: [],
        regularPrice: 280,
        salePrice: 230,
        bundlePrice: 190,
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