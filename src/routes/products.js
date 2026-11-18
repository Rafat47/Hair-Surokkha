const express = require('express');
const Product = require('../models/Product');

const router = express.Router();

// GET /api/products -> all active products (shop page)
router.get('/', async (req, res) => {
  try {
    const products = await Product.find({ isActive: true })
      .sort({ category: 1 })
      .lean();
    res.json({ ok: true, products });
  } catch (err) {
    console.error(err);
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
    // Invalid id format also lands here
    res.status(404).json({ ok: false, message: 'Product not found' });
  }
});

module.exports = router;