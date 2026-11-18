const express = require('express');
const Order = require('../models/Order');

const router = express.Router();

// GET /api/orders/:orderNumber -> thank-you page summary
// Phone and address are not returned here, so a shared link does not expose them.
router.get('/:orderNumber', async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber })
      .select('orderNumber status items subtotal deliveryCharge total eventId createdAt')
      .lean();

    if (!order) {
      return res.status(404).json({ ok: false, message: 'Order not found' });
    }

    res.json({ ok: true, order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Could not load order' });
  }
});

module.exports = router;