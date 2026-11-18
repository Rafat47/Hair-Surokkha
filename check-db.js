require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    console.log('Connected to database:', db.databaseName);

    const collections = await db.listCollections().toArray();
    for (const c of collections) {
      const count = await db.collection(c.name).countDocuments();
      console.log(`- ${c.name}: ${count} document(s)`);
    }

    const products = await db.collection('products')
      .find({}, { projection: { category: 1, title: 1, salePrice: 1, isActive: 1 } })
      .toArray();
    console.log('\nProducts:');
    console.log(products);

    await mongoose.disconnect();
  } catch (err) {
    console.error('Connection failed:', err.message);
    process.exit(1);
  }
})();