const mongoose = require('mongoose');

// Load .env file
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/erp-multi-company';

async function fixIndexes() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Get the suppliers collection
    const collection = db.collection('suppliers');

    // List all indexes
    const indexes = await collection.indexes();
    console.log('\nCurrent indexes:', indexes.map(idx => idx.name));

    // Drop old problematic indexes
    try {
      await collection.dropIndex('companyId_1_code_1');
      console.log('✓ Dropped index: companyId_1_code_1');
    } catch (e) {
      if (e.code === 27) {
        console.log('ℹ Index companyId_1_code_1 does not exist');
      } else {
        console.error('✗ Error dropping companyId_1_code_1:', e.message);
      }
    }

    try {
      await collection.dropIndex('companyId_1_name_1');
      console.log('✓ Dropped index: companyId_1_name_1');
    } catch (e) {
      if (e.code === 27) {
        console.log('ℹ Index companyId_1_name_1 does not exist');
      } else {
        console.error('✗ Error dropping companyId_1_name_1:', e.message);
      }
    }

    // Drop other old indexes if they exist
    for (const idx of indexes) {
      if (idx.name.includes('companyId')) {
        try {
          await collection.dropIndex(idx.name);
          console.log(`✓ Dropped index: ${idx.name}`);
        } catch (e) {
          console.error(`✗ Error dropping ${idx.name}:`, e.message);
        }
      }
    }

    console.log('\n✓ Index cleanup completed');

    await mongoose.connection.close();
    console.log('Connection closed');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixIndexes();
