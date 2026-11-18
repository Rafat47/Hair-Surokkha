const express = require('express');
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');

const router = express.Router();

// GET /api/reviews/product/:productId
// Returns visible reviews (newest first) and the average rating.
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ ok: false, message: 'Invalid product' });
    }

    const id = new mongoose.Types.ObjectId(productId);

    const [reviews, stats] = await Promise.all([
      Review.find({ productId: id, isVisible: true })
        .sort({ createdAt: -1 })
        .limit(50)
        .select('name rating comment createdAt')
        .lean(),
      Review.aggregate([
        { $match: { productId: id, isVisible: true } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
      ])
    ]);

    const summary = stats[0];
    res.json({
      ok: true,
      reviews,
      count: summary ? summary.count : 0,
      averageRating: summary ? Math.round(summary.avg * 10) / 10 : 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Could not load reviews' });
  }
});

// POST /api/reviews
// Body: { productId, name, rating (1-5), comment }
router.post('/', async (req, res) => {
  try {
    const { productId } = req.body;
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : '';
    const rating = parseInt(req.body.rating, 10);

    const errors = {};
    if (name.length < 2 || name.length > 60) errors.name = 'Name must be 2 to 60 characters';
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.rating = 'Choose a rating from 1 to 5';
    if (comment.length < 5 || comment.length > 1000) errors.comment = 'Review must be 5 to 1000 characters';
    if (!mongoose.Types.ObjectId.isValid(productId)) errors.productId = 'Invalid product';

    if (Object.keys(errors).length) {
      return res.status(400).json({ ok: false, message: 'Please check your review', errors });
    }

    const product = await Product.findOne({ _id: productId, isActive: true }).select('_id').lean();
    if (!product) {
      return res.status(404).json({ ok: false, message: 'Product not found' });
    }

    const review = await Review.create({ productId, name, rating, comment });

    res.status(201).json({
      ok: true,
      review: {
        name: review.name,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Could not save review' });
  }
});

module.exports = router;