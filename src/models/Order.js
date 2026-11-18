const mongoose = require('mongoose');

const STATUSES = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];

const orderItemSchema = new mongoose.Schema(
  {
    category: { type: String, enum: ['minoxidil', 'roller'], required: true },
    title: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    // Unit price actually charged, after bundle rules
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },

    customer: {
      name: { type: String, required: true, trim: true },
      // Stored as text so leading zeros in Bangladeshi numbers are kept
      phone: { type: String, required: true, trim: true },
      address: { type: String, required: true, trim: true },
      isInsideDhaka: { type: Boolean, required: true }
    },

    items: { type: [orderItemSchema], required: true },

    subtotal: { type: Number, required: true, min: 0 },
    deliveryCharge: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },

    status: { type: String, enum: STATUSES, default: 'Pending' },
    statusHistory: [
      {
        status: { type: String, enum: STATUSES },
        changedAt: { type: Date, default: Date.now }
      }
    ],

    // Used to link the browser Purchase event with the server Conversion API event
    eventId: { type: String, required: true, unique: true },

    // Visitor data that helps Meta match the purchase to the ad click
    tracking: {
      fbp: { type: String, default: '' },
      fbc: { type: String, default: '' },
      ip: { type: String, default: '' },
      userAgent: { type: String, default: '' }
    },

    // Result of the server-side Conversion API call (shown in admin for debugging)
    capi: {
      purchaseStatus: {
        type: String,
        enum: ['pending', 'sent', 'failed', 'skipped'],
        default: 'pending'
      },
      purchaseError: { type: String, default: '' },
      purchaseSentAt: { type: Date, default: null }
    }
  },
  { timestamps: true }
);

orderSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model('Order', orderSchema);