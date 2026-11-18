const express = require('express');
const productStore = require('../services/productStore');

const router = express.Router();

// GET /api/products -> all active products (shop page)
router.get('/', (req, res) => {
  res.json({ ok: true, products: productStore.getActive() });
});

// GET /api/products/:id -> one active product (product page)
router.get('/:id', (req, res) => {
  const product = productStore.getActiveById(req.params.id);
  if (!product) {
    return res.status(404).json({ ok: false, message: 'Product not found' });
  }
  res.json({ ok: true, product });
});

module.exports = router;