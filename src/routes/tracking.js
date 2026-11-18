const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const { calculateCart } = require('../services/pricing');
const { sendTrackingEvent, requestUserData } = require('../services/metaCapi');

const router = express.Router();

const ALLOWED_EVENTS = ['AddToCart', 'InitiateCheckout'];
const EVENT_ID_RE = /^[A-Za-z0-9-]{10,100}$/;

// Simple protection against floods: 120 events per IP every 10 minutes
const LIMIT_WINDOW_MS = 10 * 60 * 1000;
const LIMIT_MAX = 120;
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + LIMIT_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > LIMIT_MAX;
}

function toQty(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), 99) : 1;
}

function safePath(value) {
  return typeof value === 'string' && value.startsWith('/') && value.length <= 300 ? value : '/';
}

// AddToCart: the product ID comes from the browser, but the price comes from the database.
async function buildAddToCart(data) {
  const productId = Array.isArray(data.content_ids) ? String(data.content_ids[0] || '') : '';
  if (!mongoose.Types.ObjectId.isValid(productId)) return null;

  const product = await Product.findOne({ _id: productId, isActive: true }).lean();
  if (!product) return null;

  const qty = toQty(data.num_items);

  return {
    currency: 'BDT',
    value: product.salePrice * qty,
    content_type: 'product',
    content_ids: [product.category],
    contents: [{ id: product.category, quantity: qty, item_price: product.salePrice }],
    num_items: qty
  };
}

// InitiateCheckout: the server recalculates the full cart, including bundle rules and delivery.
async function buildInitiateCheckout(data) {
  const items = (Array.isArray(data.items) ? data.items : [])
    .filter(i => i && ['minoxidil', 'roller'].includes(i.category))
    .map(i => ({ category: i.category, quantity: toQty(i.quantity) }));

  if (!items.length) return null;

  const isInsideDhaka = data.isInsideDhaka === true || data.isInsideDhaka === 'true';
  const cart = await calculateCart(items, isInsideDhaka);
  if (!cart.items.length) return null;

  return {
    currency: cart.currency,
    value: cart.total,
    content_type: 'product',
    content_ids: cart.items.map(i => i.category),
    contents: cart.items.map(i => ({ id: i.category, quantity: i.quantity, item_price: i.unitPrice })),
    num_items: cart.items.reduce((sum, i) => sum + i.quantity, 0)
  };
}

// POST /api/tracking/event
// Body: { eventName: 'AddToCart' | 'InitiateCheckout', eventId, path, data }
// The browser sends the same eventId it gives to the Meta pixel, so Meta counts each action once.
router.post('/event', async (req, res) => {
  const { eventName, eventId, path, data } = req.body || {};

  if (!ALLOWED_EVENTS.includes(eventName)) {
    return res.status(400).json({ ok: false, message: 'Unknown event' });
  }
  if (typeof eventId !== 'string' || !EVENT_ID_RE.test(eventId)) {
    return res.status(400).json({ ok: false, message: 'Invalid event ID' });
  }
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ ok: false, message: 'Missing data' });
  }
  if (rateLimited(req.ip)) {
    return res.status(429).json({ ok: false, message: 'Too many events' });
  }

  // Answer right away. The Meta call happens after the response.
  res.status(202).json({ ok: true });

  try {
    const customData = eventName === 'AddToCart'
      ? await buildAddToCart(data)
      : await buildInitiateCheckout(data);

    if (!customData) return;

    await sendTrackingEvent({
      eventName,
      eventId,
      path: safePath(path),
      userData: requestUserData(req),
      customData
    });
  } catch (err) {
    console.error(`Tracking ${eventName} error:`, err.message);
  }
});

module.exports = router;