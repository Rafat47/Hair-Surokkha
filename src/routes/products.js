const express = require('express');
const fs = require('fs');
const Product = require('../models/Product');
const { PRODUCTS_FILE } = require('../services/productsFile');

const router = express.Router();

// Reads the products.json snapshot (public/data/products.json).
// It is rewritten on server start and after every admin change.
function readProductsFile() {
  try {
    const raw = fs.readFileSync(PRODUCTS_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.products) ? data.products : [];
  } catch (err) {
    return null;
  }
}

// GET /api/products -> all active products (shop page)
// The database is the source of truth. If it cannot be reached, the latest
// products.json snapshot is served instead.
router.get('/', async (req, res) => {
  try {
    const products = await Product.find({ isActive: true })
      .sort({ createdAt: 1 })
      .lean();
    res.json({ ok: true, products });
  } catch (err) {
    console.error(err);
    const fallback = readProductsFile();
    if (fallback) return res.json({ ok: true, products: fallback, source: 'file' });
    res.status(500).json({ ok: false, message: 'Could not load products' });
  }
});

// GET /api/products/:id -> one product (product page)
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, isActive: true }).lean();
    if (!product) {
      return res.status(404).json({ ok: false, message: 'Product not found' });
    }
    res.json({ ok: true, product });
  } catch (err) {
    // Invalid id format also lands here. Try the JSON snapshot as a fallback.
    const fallback = readProductsFile();
    const found = fallback && fallback.find(p => String(p._id) === String(req.params.id));
    if (found) return res.json({ ok: true, product: found, source: 'file' });
    res.status(404).json({ ok: false, message: 'Product not found' });
  }
});

module.exports = router;
