const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Product = require('../models/Product');

const router = express.Router();

// Uploaded images are saved in public/uploads, so the site can show them at /uploads/<file>
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      cb(null, crypto.randomBytes(10).toString('hex') + EXT_BY_MIME[file.mimetype]);
    }
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (EXT_BY_MIME[file.mimetype]) return cb(null, true);
    cb(new Error('Only JPG, PNG or WebP images are allowed'));
  }
}).single('image');

// Turns '' or missing into NaN, and text numbers into numbers
function toNumber(value) {
  if (typeof value === 'string') value = value.trim();
  if (value === '' || value == null) return NaN;
  return Number(value);
}

function validateProduct(body, category) {
  const errors = {};

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const regularPrice = toNumber(body.regularPrice);
  const salePrice = toNumber(body.salePrice);
  const images = Array.isArray(body.images)
    ? body.images.map(item => String(item).trim()).filter(Boolean)
    : [];
  const isActive = body.isActive === true || body.isActive === 'true';

  if (title.length < 2 || title.length > 120) {
    errors.title = 'Title must be 2 to 120 characters';
  }
  if (description.length > 5000) {
    errors.description = 'Description is too long';
  }
  if (!Number.isFinite(regularPrice) || regularPrice < 0) {
    errors.regularPrice = 'Enter a valid regular price';
  }
  if (!Number.isFinite(salePrice) || salePrice < 0) {
    errors.salePrice = 'Enter a valid sale price';
  }
  if (!errors.regularPrice && !errors.salePrice && salePrice > regularPrice) {
    errors.salePrice = 'Sale price cannot be higher than regular price';
  }

  // Only the roller has a bundle price. Minoxidil always stores null.
  let bundlePrice = null;
  if (category === 'roller') {
    bundlePrice = toNumber(body.bundlePrice);
    if (!Number.isFinite(bundlePrice) || bundlePrice < 0) {
      errors.bundlePrice = 'Enter a valid bundle price';
    } else if (!errors.salePrice && bundlePrice > salePrice) {
      errors.bundlePrice = 'Bundle price cannot be higher than sale price';
    }
  }

  if (images.length > 10) {
    errors.images = 'Use up to 10 images';
  } else if (images.some(url => !(url.startsWith('/') || /^https?:\/\//.test(url)))) {
    errors.images = 'Each image must be a link starting with / or http';
  }

  return {
    errors,
    data: { title, description, regularPrice, salePrice, bundlePrice, images, isActive }
  };
}

// GET /api/admin/products -> all products, including inactive ones
router.get('/', async (req, res) => {
  try {
    const products = await Product.find({}).sort({ category: 1 }).lean();
    res.json({ ok: true, products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Could not load products' });
  }
});

// POST /api/admin/products/upload -> saves one image, returns its public path
router.post('/upload', (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Image must be 3 MB or smaller'
        : err.message;
      return res.status(400).json({ ok: false, message });
    }
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'Choose an image first' });
    }
    res.status(201).json({ ok: true, url: `/uploads/${req.file.filename}` });
  });
});

// PUT /api/admin/products/:id -> update one product
router.put('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ ok: false, message: 'Product not found' });
    }

    const { errors, data } = validateProduct(req.body, product.category);
    if (Object.keys(errors).length) {
      return res.status(400).json({ ok: false, message: 'Please check the form', errors });
    }

    Object.assign(product, data);
    await product.save();

    res.json({ ok: true, product: product.toObject() });
  } catch (err) {
    // Invalid id format lands here too
    if (err.name === 'CastError') {
      return res.status(404).json({ ok: false, message: 'Product not found' });
    }
    console.error(err);
    res.status(500).json({ ok: false, message: 'Could not save product' });
  }
});

module.exports = router;