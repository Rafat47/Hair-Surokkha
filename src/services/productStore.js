const fs = require('fs');
const path = require('path');
const Product = require('../models/Product');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'products.json');

let products = [];

// Loads every product from the database, keeps them in memory,
// and saves a copy to data/products.json. Called at startup and after every admin change.
async function refresh() {
    const docs = await Product.find({}).sort({ createdAt: 1 }).lean();
    products = docs.map(doc => ({ ...doc, _id: String(doc._id) }));

    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    await fs.promises.writeFile(DATA_FILE, JSON.stringify(products, null, 2), 'utf8');

    return products;
}

async function init() {
    // Removes the old unique index on "category", so products can share a category
    try {
        await Product.syncIndexes();
    } catch (err) {
        console.error('Index sync warning:', err.message);
    }

    await refresh();
    console.log(`Products loaded: ${products.length}`);
}

function getActive() {
    return products.filter(p => p.isActive !== false);
}

function getActiveById(id) {
    return products.find(p => p._id === String(id) && p.isActive !== false) || null;
}

module.exports = { init, refresh, getActive, getActiveById };