// Makes sure the admin account from .env exists in the database.
// The password in .env is hashed with bcrypt before it is stored.
// If you change ADMIN_PASSWORD in .env and restart the server, the stored hash is updated.

const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');

async function ensureAdminAccount() {
  const email = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || '';

  if (!email || !password) {
    console.error('ADMIN_EMAIL or ADMIN_PASSWORD is missing in .env. Admin login will not work.');
    return;
  }

  const existing = await Admin.findOne({ email });

  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 12);
    await Admin.create({ email, passwordHash });
    console.log('Admin account created');
    return;
  }

  const matches = await bcrypt.compare(password, existing.passwordHash);
  if (!matches) {
    existing.passwordHash = await bcrypt.hash(password, 12);
    await existing.save();
    console.log('Admin password updated from .env');
  }
}

module.exports = { ensureAdminAccount };