const express = require('express');
const crypto = require('crypto');
const Order = require('../models/Order');
const { calculateCart } = require('../services/pricing');
const { validateCustomer } = require('../services/validation');
const { sendPurchaseEvent } = require('../services/metaCapi');

const router = express.Router();

// Order number like PS-260518-4F2K9
function makeOrderNumber() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 5);
  return `PS-${yy}${mm}${dd}-${rand}`;
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '';
}

// POST /api/checkout
// Body: {
//   items: [{ category, quantity }],
//   isInsideDhaka: true | false,
//   customer: { name, phone, address }
// }
router.post('/', async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ ok: false, message: 'Your cart is empty' });
    }

    const customerCheck = validateCustomer(req.body.customer);
    if (!customerCheck.ok) {
      return res.status(400).json({ ok: false, message: 'Please check your details', errors: customerCheck.errors });
    }

    const isInsideDhaka = req.body.isInsideDhaka === true || req.body.isInsideDhaka === 'true';

    // Recalculate everything on the server. Client totals are ignored.
    const cart = await calculateCart(items, isInsideDhaka);
    if (cart.items.length === 0) {
      return res.status(400).json({ ok: false, message: 'No valid products in cart' });
    }

    const eventId = crypto.randomUUID();
    const { name, phone, address } = customerCheck.data;

    const order = await Order.create({
      orderNumber: makeOrderNumber(),
      customer: { name, phone, address, isInsideDhaka },
      items: cart.items,
      subtotal: cart.subtotal,
      deliveryCharge: cart.deliveryCharge,
      total: cart.total,
      status: 'Pending',
      statusHistory: [{ status: 'Pending' }],
      eventId,
      tracking: {
        fbp: req.cookies._fbp || '',
        fbc: req.cookies._fbc || '',
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'] || ''
      }
    });

    // Send Purchase to Meta from the server. Not awaited, so the customer is not kept waiting.
    sendPurchaseEvent(order).catch(err => console.error(err));

    res.status(201).json({
      ok: true,
      orderNumber: order.orderNumber,
      eventId: order.eventId,
      total: order.total,
      currency: cart.currency
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Could not place order' });
  }
});

module.exports = router;