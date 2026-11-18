const express = require('express');
const { getSettings } = require('../services/pricing');

const router = express.Router();

// Whole numbers only. Returns NaN for empty or invalid input.
function toInt(value) {
  if (typeof value === 'string') value = value.trim();
  if (value === '' || value == null) return NaN;
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
}

// The token itself is never returned. The browser only learns whether one is saved.
function publicSettings(s) {
  return {
    deliveryInsideDhaka: s.deliveryInsideDhaka,
    deliveryOutsideDhaka: s.deliveryOutsideDhaka,
    freeDeliveryMinMinoxidil: s.freeDeliveryMinMinoxidil,
    minoxidilTwoPiecePrice: s.minoxidilTwoPiecePrice,
    minoxidilThreePiecePrice: s.minoxidilThreePiecePrice,
    metaPixelId: s.metaPixelId,
    metaTestEventCode: s.metaTestEventCode || '',
    currency: s.currency,
    hasCapiToken: Boolean(s.metaCapiToken)
  };
}

// GET /api/admin/settings
router.get('/', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({ ok: true, settings: publicSettings(settings) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Could not load settings' });
  }
});

// PUT /api/admin/settings
// Body: {
//   deliveryInsideDhaka, deliveryOutsideDhaka, freeDeliveryMinMinoxidil,
//   minoxidilTwoPiecePrice, minoxidilThreePiecePrice,
//   metaPixelId, metaTestEventCode,
//   metaCapiToken (optional, leave empty to keep the saved token),
//   clearToken (optional, true removes the saved token)
// }
router.put('/', async (req, res) => {
  try {
    const body = req.body || {};
    const errors = {};

    const deliveryInsideDhaka = toInt(body.deliveryInsideDhaka);
    const deliveryOutsideDhaka = toInt(body.deliveryOutsideDhaka);
    const freeDeliveryMinMinoxidil = toInt(body.freeDeliveryMinMinoxidil);
    const minoxidilTwoPiecePrice = toInt(body.minoxidilTwoPiecePrice);
    const minoxidilThreePiecePrice = toInt(body.minoxidilThreePiecePrice);

    if (!(deliveryInsideDhaka >= 0)) errors.deliveryInsideDhaka = 'Enter a whole number, 0 or more';
    if (!(deliveryOutsideDhaka >= 0)) errors.deliveryOutsideDhaka = 'Enter a whole number, 0 or more';
    if (!(freeDeliveryMinMinoxidil >= 1)) errors.freeDeliveryMinMinoxidil = 'Enter a whole number, 1 or more';
    if (!(minoxidilTwoPiecePrice >= 0)) errors.minoxidilTwoPiecePrice = 'Enter a whole number, 0 or more';
    if (!(minoxidilThreePiecePrice >= 0)) {
      errors.minoxidilThreePiecePrice = 'Enter a whole number, 0 or more';
    } else if (!errors.minoxidilTwoPiecePrice && minoxidilThreePiecePrice < minoxidilTwoPiecePrice) {
      errors.minoxidilThreePiecePrice = 'Cannot be lower than the 2-piece price';
    }

    const metaPixelId = typeof body.metaPixelId === 'string' ? body.metaPixelId.trim() : '';
    if (!/^\d{5,20}$/.test(metaPixelId)) {
      errors.metaPixelId = 'Pixel ID must be 5 to 20 digits';
    }

    const metaTestEventCode = typeof body.metaTestEventCode === 'string' ? body.metaTestEventCode.trim() : '';
    if (!/^[A-Za-z0-9_-]{0,40}$/.test(metaTestEventCode)) {
      errors.metaTestEventCode = 'Use letters, numbers, - or _ only (max 40)';
    }

    const newToken = typeof body.metaCapiToken === 'string' ? body.metaCapiToken.trim() : '';
    if (newToken.length > 500) {
      errors.metaCapiToken = 'Token is too long';
    }

    if (Object.keys(errors).length) {
      return res.status(400).json({ ok: false, message: 'Please check the form', errors });
    }

    const settings = await getSettings();

    Object.assign(settings, {
      deliveryInsideDhaka,
      deliveryOutsideDhaka,
      freeDeliveryMinMinoxidil,
      minoxidilTwoPiecePrice,
      minoxidilThreePiecePrice,
      metaPixelId,
      metaTestEventCode
    });

    if (body.clearToken === true || body.clearToken === 'true') {
      settings.metaCapiToken = '';
    } else if (newToken) {
      settings.metaCapiToken = newToken;
    }

    await settings.save();

    res.json({ ok: true, settings: publicSettings(settings) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Could not save settings' });
  }
});

module.exports = router;