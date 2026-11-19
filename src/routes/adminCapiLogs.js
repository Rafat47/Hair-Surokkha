const express = require('express');
const CapiLog = require('../models/CapiLog');

const router = express.Router();
const PAGE_SIZE = 25;
const EVENTS = ['Purchase', 'AddToCart', 'InitiateCheckout'];
const STATUSES = ['sent', 'failed', 'skipped'];

// GET /api/admin/capi-logs?page=1&status=failed&event=Purchase
router.get('/', async (req, res) => {
    try {
        const filter = {};
        if (STATUSES.includes(req.query.status)) filter.status = req.query.status;
        if (EVENTS.includes(req.query.event)) filter.eventName = req.query.event;

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);

        const [logs, total] = await Promise.all([
            CapiLog.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * PAGE_SIZE)
                .limit(PAGE_SIZE)
                .select('-sentPayload -metaResponse')
                .lean(),
            CapiLog.countDocuments(filter)
        ]);

        res.json({
            ok: true,
            logs,
            total,
            page,
            pages: Math.max(1, Math.ceil(total / PAGE_SIZE))
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, message: 'Could not load log' });
    }
});

// GET /api/admin/capi-logs/:id -> one entry with the full payload and Meta's reply
router.get('/:id', async (req, res) => {
    try {
        const log = await CapiLog.findById(req.params.id).lean();
        if (!log) return res.status(404).json({ ok: false, message: 'Entry not found' });
        res.json({ ok: true, log });
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ ok: false, message: 'Entry not found' });
        }
        console.error(err);
        res.status(500).json({ ok: false, message: 'Could not load entry' });
    }
});

// DELETE /api/admin/capi-logs -> clears the whole log
router.delete('/', async (req, res) => {
    try {
        await CapiLog.deleteMany({});
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, message: 'Could not clear log' });
    }
});

module.exports = router;