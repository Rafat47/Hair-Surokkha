// One-time conversion of older products to the business logic fields.
// Only touches products that do not have businessLogic yet, so it is safe on every start.

const Product = require('../models/Product');
const Settings = require('../models/Settings');

async function migrateProducts() {
    const col = Product.collection;
    const pending = await col.find({ businessLogic: { $exists: false } }).toArray();
    if (!pending.length) return;

    const settings = await Settings.findOne({ key: 'main' }).lean();

    for (const doc of pending) {
        let businessLogic = 'none';
        let logicValues = {};

        if (doc.bundlePrice != null) {
            businessLogic = 'bundle-price';
            logicValues = { bundlePrice: doc.bundlePrice };
        } else if (doc.category === 'minoxidil' && settings) {
            businessLogic = 'quantity-pricing';
            logicValues = {
                twoPrice: settings.minoxidilTwoPiecePrice,
                threePrice: settings.minoxidilThreePiecePrice
            };
        }

        await col.updateOne(
            { _id: doc._id },
            { $set: { businessLogic, logicValues }, $unset: { bundlePrice: '' } }
        );
    }

    console.log(`Migrated ${pending.length} product(s) to business logic`);
}

module.exports = { migrateProducts };