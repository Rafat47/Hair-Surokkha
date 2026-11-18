// Creates the settings document on first start.
// Products are NOT seeded here anymore: they are fully managed (add / edit /
// delete) from the admin panel and stored in MongoDB. Existing data is never
// overwritten, so changes made in the admin panel are kept.

const Product = require('../models/Product');
const Settings = require('../models/Settings');

async function seedDefaults() {
  await Settings.updateOne(
    { key: 'main' },
    { $setOnInsert: { key: 'main' } },
    { upsert: true }
  );

  // Drop the old "unique category" index from earlier versions, so more than
  // one product can exist.
  await Product.dropLegacyCategoryIndex();

  console.log('Default settings are ready');
}

module.exports = { seedDefaults };
