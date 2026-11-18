// Products JSON file.
// Every time the website (server) starts, all active products are pulled from
// MongoDB and written to public/data/products.json. The shop pages read this
// file first, so product data is served instantly.
// Whenever a product is added, edited or deleted in the admin panel, the
// database is updated first and this file is refreshed right after.

const fs = require('fs');
const path = require('path');
const Product = require('../models/Product');

const DATA_DIR = path.join(__dirname, '..', '..', 'public', 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');

async function refreshProductsFile() {
  const products = await Product.find({ isActive: true })
    .sort({ createdAt: 1 })
    .lean();

  const payload = JSON.stringify(
    { updatedAt: new Date().toISOString(), count: products.length, products },
    null,
    2
  );

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PRODUCTS_FILE, payload, 'utf8');
  return products;
}

module.exports = { refreshProductsFile, PRODUCTS_FILE };
