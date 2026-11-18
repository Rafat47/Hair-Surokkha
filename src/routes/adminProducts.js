const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Product = require('../models/Product');
const productStore = require('../services/productStore');

const router = express.Router();

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

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toNumber(value) {
  if (typeof value === 'string') value = value.trim();
  if (value === '' || value == null) return NaN;
  return Number(value);
}

// Every field is required when adding or editing a product.
// Every field is required, except the bundle price, which may be left empty.
function validateProduct(body) {
  const errors = {};

  const category = text(body.category);
  const title = text(body.title);
  const description = text(body.description);
  const regularPrice = toNumber(body.regularPrice);
  const salePrice = toNumber(body.salePrice);
  const bundleEmpty = body.bundlePrice == null || String(body.bundlePrice).trim() === '';
  const bundleValue = toNumber(body.bundlePrice);
  const images = Array.isArray(body.images)
    ? body.images.map(item => text(item)).filter(Boolean)
    : [];
  const isActive = body.isActive === true || body.isActive === 'true';

  if (!category || category.length > 40) {
    errors.category = 'Category is required (max 40 characters)';
  }
  if (title.length < 2 || title.length > 120) {
    errors.title = 'Title must be 2 to 120 characters';
  }
  if (!description || description.length > 5000) {
    errors.description = 'Description is required (max 5000 characters)';
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

  // Bundle price is optional. Empty means no bundle.
  let bundlePrice = null;
  if (!bundleEmpty) {
    if (!Number.isFinite(bundleValue) || bundleValue < 0) {
      errors.bundlePrice = 'Bundle price must be a number, or left empty';
    } else if (!errors.salePrice && bundleValue > salePrice) {
      errors.bundlePrice = 'Bundle price cannot be higher than sale price';
    } else {
      bundlePrice = bundleValue;
    }
  }

  if (images.length === 0) {
    errors.images = 'Add at least one image';
  } else if (images.length > 10) {
    errors.images = 'Use up to 10 images';
  } else if (images.some(url => !(url.startsWith('/') || /^https?:\/\//.test(url)))) {
    errors.images = 'Each image must be a link starting with / or http';
  }

  return {
    errors,
    data: { category, title, description, regularPrice, salePrice, bundlePrice, images, isActive }
  };
}

function handleError(err, res, message) {
  if (err.name === 'CastError') {
    return res.status(404).json({ ok: false, message: 'Product not found' });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ ok: false, message: 'Please fill in every field' });
  }
  console.error(err);
  res.status(500).json({ ok: false, message });
}

// GET /api/admin/products -> all products, active and hidden
router.get('/', async (req, res) => {
  try {
    const products = await Product.find({}).sort({ createdAt: 1 }).lean();
    res.json({ ok: true, products });
  } catch (err) {
    handleError(err, res, 'Could not load products');
  }
});

// POST /api/admin/products -> add a product
router.post('/', async (req, res) => {
  try {
    const { errors, data } = validateProduct(req.body);
    if (Object.keys(errors).length) {
      return res.status(400).json({ ok: false, message: 'Please fill in every field', errors });
    }

    const product = await Product.create(data);
    await productStore.refresh();

    res.status(201).json({ ok: true, product: product.toObject() });
  } catch (err) {
    handleError(err, res, 'Could not add product');
  }
});

// POST /api/admin/products/upload -> saves one image and returns its public path
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

// PUT /api/admin/products/:id -> edit a product
router.put('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ ok: false, message: 'Product not found' });
    }

    const { errors, data } = validateProduct(req.body);
    if (Object.keys(errors).length) {
      return res.status(400).json({ ok: false, message: 'Please fill in every field', errors });
    }

    Object.assign(product, data);
    await product.save();
    await productStore.refresh();

    res.json({ ok: true, product: product.toObject() });
  } catch (err) {
    handleError(err, res, 'Could not save product');
  }
});

// DELETE /api/admin/products/:id -> delete a product from the database
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ ok: false, message: 'Product not found' });
    }

    await productStore.refresh();
    res.json({ ok: true });
  } catch (err) {
    handleError(err, res, 'Could not delete product');
  }
});

module.exports = router;