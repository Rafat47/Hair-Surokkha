const mongoose = require('mongoose');

// There is only one settings document. It is created on first start.
const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },

    // Minoxidil quantity prices, used by the "1x - 2x - 3x" business logic (see migrateProducts.js)
    minoxidilTwoPiecePrice: { type: Number, default: 1600 },
    minoxidilThreePiecePrice: { type: Number, default: 2400 },

    // Delivery
    deliveryInsideDhaka: { type: Number, default: 70 },
    deliveryOutsideDhaka: { type: Number, default: 130 },
    // Free delivery when the cart has this many units from logics that count toward it
    freeDeliveryMinMinoxidil: { type: Number, default: 3 },

    // Meta tracking. The token is only used on the server, never sent to the browser.
    metaPixelId: { type: String, default: '1722516656187525' },
    metaCapiToken: { type: String, default: '' },
    metaTestEventCode: { type: String, default: '' },

    // When true, every Conversion API call is saved to the capi_log collection
    capiLogEnabled: { type: Boolean, default: false },

    currency: { type: String, default: 'BDT' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);