const express = require('express');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const { requireAdminApi } = require('../middleware/requireAdmin');

const router = express.Router();

// Simple lockout: 5 failed logins from one IP blocks it for 15 minutes.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map();

function isBlocked(ip) {
  const entry = attempts.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    attempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

// POST /api/admin/login  Body: { email, password }
router.post('/login', async (req, res) => {
  try {
    const ip = req.ip;

    if (isBlocked(ip)) {
      return res.status(429).json({ ok: false, message: 'Too many attempts. Try again in 15 minutes.' });
    }

    const email = typeof req.body.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      return res.status(400).json({ ok: false, message: 'Enter your email and password' });
    }

    const admin = await Admin.findOne({ email });
    const valid = admin && await bcrypt.compare(password, admin.passwordHash);

    if (!valid) {
      recordFailure(ip);
      return res.status(401).json({ ok: false, message: 'Wrong email or password' });
    }

    attempts.delete(ip);

    // New session ID after login prevents session fixation
    req.session.regenerate(err => {
      if (err) {
        console.error(err);
        return res.status(500).json({ ok: false, message: 'Could not log in' });
      }
      req.session.adminId = String(admin._id);
      req.session.adminEmail = admin.email;
      res.json({ ok: true });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Could not log in' });
  }
});

// POST /api/admin/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('picaso.sid');
    res.json({ ok: true });
  });
});

// GET /api/admin/me -> current admin, or 401
router.get('/me', requireAdminApi, (req, res) => {
  res.json({ ok: true, email: req.session.adminEmail });
});

module.exports = router;