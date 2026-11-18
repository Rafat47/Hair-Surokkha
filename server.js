require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');

const connectDB = require('./src/config/db');
const { seedDefaults } = require('./src/config/seed');
const { ensureAdminAccount } = require('./src/services/adminAccount');
const { requireAdminApi } = require('./src/middleware/requireAdmin');

const productsRouter = require('./src/routes/products');
const cartRouter = require('./src/routes/cart');
const checkoutRouter = require('./src/routes/checkout');
const ordersRouter = require('./src/routes/orders');
const reviewsRouter = require('./src/routes/reviews');
const trackingRouter = require('./src/routes/tracking');
const adminAuthRouter = require('./src/routes/adminAuth');
const adminProductsRouter = require('./src/routes/adminProducts');
const adminOrdersRouter = require('./src/routes/adminOrders');
const adminSettingsRouter = require('./src/routes/adminSettings');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Body parsers and cookies (cookies are used for Meta fbp and fbc)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Admin sessions, stored in MongoDB
app.use(session({
  name: 'picaso.sid',
  secret: process.env.SESSION_SECRET || 'change-me',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000 // 8 hours
  }
}));

// Admin pages (HTML) need a logged-in session, except the login page.
// Admin CSS and JS files are public, because the login page needs them.
app.use((req, res, next) => {
  if (!req.path.startsWith('/admin')) return next();

  const isPage = req.path.endsWith('.html') || req.path === '/admin' || req.path === '/admin/';
  if (!isPage) return next();
  if (req.path === '/admin/login.html') return next();
  if (req.session && req.session.adminId) return next();

  return res.redirect('/admin/login.html');
});

// Static files (HTML, CSS, JS, images, uploads)
app.use(express.static(PUBLIC_DIR));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Picaso server is running' });
});

// Admin API
app.use('/api/admin', adminAuthRouter);
app.use('/api/admin/products', requireAdminApi, adminProductsRouter);
app.use('/api/admin/orders', requireAdminApi, adminOrdersRouter);
app.use('/api/admin/settings', requireAdminApi, adminSettingsRouter);

// Shop API
app.use('/api/products', productsRouter);
app.use('/api/cart', cartRouter);
app.use('/api/checkout', checkoutRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/tracking', trackingRouter);

// Unknown API route
app.use('/api', (req, res) => {
  res.status(404).json({ ok: false, message: 'Not found' });
});

// Unknown page route: show the 404 page for browser requests
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
});

// Last-resort error handler
app.use((err, req, res, next) => {
  console.error(err);

  if (req.path.startsWith('/api')) {
    return res.status(500).json({ ok: false, message: 'Server error' });
  }

  if (res.headersSent) return next(err);
  res.status(500).sendFile(path.join(PUBLIC_DIR, '500.html'));
});

async function start() {
  await connectDB();
  await seedDefaults();
  await ensureAdminAccount();
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

start();