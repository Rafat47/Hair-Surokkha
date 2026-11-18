const express = require('express');
const Order = require('../models/Order');
const { sendPurchaseEvent } = require('../services/metaCapi');

const router = express.Router();
const STATUSES = Order.STATUSES;
const PAGE_SIZE = 25;

// Escapes characters that have a special meaning in regular expressions
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /api/admin/orders?page=1&status=Pending&q=search
router.get('/', async (req, res) => {
  try {
    const filter = {};

    if (STATUSES.includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [
        { orderNumber: rx },
        { 'customer.name': rx },
        { 'customer.phone': rx }
      ];
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .select('orderNumber createdAt status total customer.name customer.phone items.category items.quantity capi.purchaseStatus')
        .lean(),
      Order.countDocuments(filter)
    ]);

    res.json({
      ok: true,
      orders,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      statuses: STATUSES
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Could not load orders' });
  }
});

// GET /api/admin/orders/:id -> full order details (tracking data is hidden)
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).select('-tracking').lean();
    if (!order) {
      return res.status(404).json({ ok: false, message: 'Order not found' });
    }
    res.json({ ok: true, order });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ ok: false, message: 'Order not found' });
    }
    console.error(err);
    res.status(500).json({ ok: false, message: 'Could not load order' });
  }
});

// PATCH /api/admin/orders/:id/status  Body: { status }
router.patch('/:id/status', async (req, res) => {
  try {
    const status = req.body.status;
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ ok: false, message: 'Invalid status' });
    }

    // Only updates when the status really changes, and records it in the history
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: status } },
      {
        $set: { status },
        $push: { statusHistory: { status, changedAt: new Date() } }
      },
      { new: true }
    ).select('orderNumber status').lean();

    if (!order) {
      const exists = await Order.exists({ _id: req.params.id });
      if (!exists) {
        return res.status(404).json({ ok: false, message: 'Order not found' });
      }
      return res.json({ ok: true, unchanged: true });
    }

    res.json({ ok: true, order });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ ok: false, message: 'Order not found' });
    }
    console.error(err);
    res.status(500).json({ ok: false, message: 'Could not update status' });
  }
});

// POST /api/admin/orders/:id/resend-purchase
// Sends the server-side Purchase event again. Meta ignores it if the first one already counted.
router.post('/:id/resend-purchase', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) {
      return res.status(404).json({ ok: false, message: 'Order not found' });
    }

    await sendPurchaseEvent(order);

    const updated = await Order.findById(order._id).select('capi').lean();
    res.json({ ok: true, capi: updated.capi });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ ok: false, message: 'Order not found' });
    }
    console.error(err);
    res.status(500).json({ ok: false, message: 'Could not resend Purchase event' });
  }
});

module.exports = router;