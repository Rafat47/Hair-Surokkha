// Server-side Meta Conversion API.
// Purchase is sent right after an order is saved.
// AddToCart and InitiateCheckout are sent when the browser reports them (see routes/tracking.js).
// Each event uses an event_id that the browser pixel also uses, so Meta counts each action once.

const crypto = require('crypto');
const Order = require('../models/Order');
const { getSettings } = require('./pricing');

const GRAPH_VERSION = 'v21.0';

function siteUrl() {
  return process.env.SITE_URL || `http://localhost:${process.env.PORT || 3000}`;
}

// Meta requires personal data to be lowercase, trimmed and SHA-256 hashed.
function sha256(value) {
  const clean = String(value || '').trim().toLowerCase();
  if (!clean) return null;
  return crypto.createHash('sha256').update(clean).digest('hex');
}

// Bangladeshi numbers: 01XXXXXXXXX becomes 8801XXXXXXXXX (digits only, country code first)
function normalizePhone(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '880' + digits.slice(1);
  return digits;
}

function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') };
}

// Visitor data taken from the request (no personal details)
function requestUserData(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' && forwarded.length
    ? forwarded.split(',')[0].trim()
    : (req.socket.remoteAddress || '');

  return {
    client_ip_address: ip || undefined,
    client_user_agent: req.headers['user-agent'] || undefined,
    fbp: req.cookies._fbp || undefined,
    fbc: req.cookies._fbc || undefined
  };
}

function orderUserData(order) {
  const { first, last } = splitName(order.customer.name);
  const phoneHash = sha256(normalizePhone(order.customer.phone));

  return {
    ph: phoneHash ? [phoneHash] : [],
    fn: sha256(first) || undefined,
    ln: sha256(last) || undefined,
    country: sha256('bd'),
    client_ip_address: order.tracking.ip || undefined,
    client_user_agent: order.tracking.userAgent || undefined,
    fbp: order.tracking.fbp || undefined,
    fbc: order.tracking.fbc || undefined
  };
}

// Sends one or more events to Meta. Returns { status, error }.
async function postToMeta(events) {
  const settings = await getSettings();

  if (!settings.metaCapiToken) {
    return { status: 'skipped', error: 'Conversion API token is not set in admin settings' };
  }

  const body = { data: events };
  if (settings.metaTestEventCode) {
    body.test_event_code = settings.metaTestEventCode;
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${settings.metaPixelId}/events` +
    `?access_token=${encodeURIComponent(settings.metaCapiToken)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000)
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.error) {
    const message = data.error ? data.error.message : `HTTP ${res.status}`;
    return { status: 'failed', error: message };
  }

  return { status: 'sent', error: '' };
}

async function saveOrderResult(orderId, result) {
  await Order.updateOne(
    { _id: orderId },
    {
      $set: {
        'capi.purchaseStatus': result.status,
        'capi.purchaseError': result.error || '',
        'capi.purchaseSentAt': result.status === 'sent' ? new Date() : null
      }
    }
  );
}

// Purchase for one order. Never throws, so checkout is not blocked.
// Purchase for one order. Never throws, so checkout is not blocked.
async function sendPurchaseEvent(order) {
  try {
    const event = {
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: order.eventId,
      action_source: 'website',
      event_source_url: `${siteUrl()}/thank-you.html?order=${encodeURIComponent(order.orderNumber)}`,
      user_data: orderUserData(order),
      custom_data: {
        currency: 'BDT',
        value: order.total,
        order_id: order.orderNumber,
        content_type: 'product',
        content_ids: order.items.map(item => item.productId),
        contents: order.items.map(item => ({
          id: item.productId,
          quantity: item.quantity,
          item_price: item.unitPrice
        })),
        num_items: order.items.reduce((sum, item) => sum + item.quantity, 0)
      }
    };

    const result = await postToMeta([event]);
    if (result.status === 'failed') console.error('Meta CAPI Purchase failed:', result.error);
    await saveOrderResult(order._id, result);
  } catch (err) {
    console.error('Meta CAPI Purchase error:', err.message);
    await Order.updateOne(
      { _id: order._id },
      { $set: { 'capi.purchaseStatus': 'failed', 'capi.purchaseError': err.message } }
    ).catch(() => { });
  }
}

// Sends a non-purchase event (AddToCart, InitiateCheckout). Never throws.
async function sendTrackingEvent({ eventName, eventId, path, userData, customData }) {
  try {
    const event = {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: 'website',
      event_source_url: `${siteUrl()}${path}`,
      user_data: userData,
      custom_data: customData
    };

    const result = await postToMeta([event]);
    if (result.status === 'failed') {
      console.error(`Meta CAPI ${eventName} failed:`, result.error);
    }
  } catch (err) {
    console.error(`Meta CAPI ${eventName} error:`, err.message);
  }
}

module.exports = { sendPurchaseEvent, sendTrackingEvent, requestUserData };