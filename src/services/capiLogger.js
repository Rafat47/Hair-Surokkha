// Saves one Conversion API attempt to the capi_log collection.
// Does nothing when logging is off in admin Settings. Never throws, so tracking is not affected.

const CapiLog = require('../models/CapiLog');

async function record(settings, entry) {
    if (!settings || !settings.capiLogEnabled) return;

    try {
        await CapiLog.create(entry);
    } catch (err) {
        console.error('CAPI log save failed:', err.message);
    }
}

module.exports = { record };