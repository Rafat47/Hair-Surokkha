const mongoose = require('mongoose');

// Stores what was sent to Meta and how Meta responded.
// The collection is named capi_log. Entries older than 30 days are removed automatically.
const capiLogSchema = new mongoose.Schema(
    {
        eventName: { type: String, required: true },
        eventId: { type: String, default: '' },
        orderNumber: { type: String, default: '' },
        pixelId: { type: String, default: '' },
        testEventCode: { type: String, default: '' },

        status: { type: String, enum: ['sent', 'failed', 'skipped'], required: true },
        success: { type: Boolean, default: false },

        httpStatus: { type: Number, default: 0 },
        eventsReceived: { type: Number, default: 0 },
        fbtraceId: { type: String, default: '' },
        errorMessage: { type: String, default: '' },

        // Exactly what the server sent to Meta (the "data" array of the request)
        sentPayload: { type: mongoose.Schema.Types.Mixed, default: null },
        // Exactly what Meta replied
        metaResponse: { type: mongoose.Schema.Types.Mixed, default: null }
    },
    { timestamps: true, collection: 'capi_log' }
);

capiLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = mongoose.model('CapiLog', capiLogSchema);