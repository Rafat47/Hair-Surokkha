const mongoose = require('mongoose');

// There is only one settings document. It is created on first start.
const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },

    // Minoxidil bundle prices. One piece uses Product.salePrice.
    minoxidilTwoPiecePrice: { type: Number, default: 1600 },
    minoxidilThreePiecePrice: { type: Number, default: 2400 },

    // Delivery
    deliveryInsideDhaka: { type: Number, default: 70 },
    deliveryOutsideDhaka: { type: Number, default: 130 },
    // Delivery is free when minoxidil quantity is at least this number
    freeDeliveryMinMinoxidil: { type: Number, default: 3 },

    // Meta tracking. The token is only used on the server, never sent to the browser.
    metaPixelId: { type: String, default: '1722516656187525' },
    metaCapiToken: { type: String, default: '' },
    metaTestEventCode: { type: String, default: '' },

    currency: { type: String, default: 'BDT' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);