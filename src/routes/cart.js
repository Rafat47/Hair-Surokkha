const express = require('express');
const { calculateCart } = require('../services/pricing');

const router = express.Router();

// POST /api/cart/calculate
// Body: { items: [{ category: 'minoxidil' | 'roller', quantity: 2 }], isInsideDhaka: true }
// The browser sends only categories and quantities. All prices come from the server.
router.post('/calculate', async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const isInsideDhaka = req.body.isInsideDhaka === true || req.body.isInsideDhaka === 'true';

    const cart = await calculateCart(items, isInsideDhaka);
    res.json({ ok: true, ...cart });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Could not calculate cart' });
  }
});

module.exports = router;