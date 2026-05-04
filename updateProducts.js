// updateProducts.js
// Script to batch update all products with default values for new fields

const mongoose = require('mongoose');
const Product = require('./models/Product'); // Adjust path if needed

const MONGO_URI = 'mongodb://localhost:27017/smartEprinting'; // Update if your DB URI is different

async function updateProducts() {
  await mongoose.connect(MONGO_URI);

  const defaultFields = {
    technology: [],
    mainFunction: [],
    wireless: '',
    usageCategory: [],
    allInOneType: []
  };

  const products = await Product.find({});
  let updatedCount = 0;

  for (const product of products) {
    let needsUpdate = false;
    for (const key in defaultFields) {
      if (typeof product[key] === 'undefined') {
        product[key] = defaultFields[key];
        needsUpdate = true;
      }
    }
    if (needsUpdate) {
      await product.save();
      updatedCount++;
    }
  }

  console.log(`Updated ${updatedCount} products.`);
  mongoose.disconnect();
}

updateProducts().catch(err => {
  console.error('Error updating products:', err);
  mongoose.disconnect();
});
