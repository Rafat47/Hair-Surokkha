// Blocks admin API calls when no admin session exists.
function requireAdminApi(req, res, next) {
  if (req.session && req.session.adminId) return next();
  return res.status(401).json({ ok: false, message: 'Please log in' });
}

module.exports = { requireAdminApi };