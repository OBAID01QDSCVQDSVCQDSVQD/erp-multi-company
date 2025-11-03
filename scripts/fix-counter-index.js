const mongoose = require('mongoose');

require('dotenv').config({ path: '.env.local' });
const MONGODB_URI = process.env.MONGODB_URI;

async function fixCounterIndexes() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    
    const db = mongoose.connection.db;
    const collection = db.collection('counters');
    
    console.log('Checking existing indexes...');
    const indexes = await collection.indexes();
    console.log('Current indexes:', JSON.stringify(indexes, null, 2));
    
    // Drop old index if it exists
    try {
      await collection.dropIndex('tenantId_1_type_1_year_1');
      console.log('✅ Dropped old index: tenantId_1_type_1_year_1');
    } catch (err) {
      if (err.code === 27) {
        console.log('ℹ️  Old index tenantId_1_type_1_year_1 does not exist');
      } else {
        throw err;
      }
    }
    
    // Ensure the correct index exists
    try {
      await collection.createIndex({ tenantId: 1, seqName: 1 }, { unique: true });
      console.log('✅ Created/verified correct index: { tenantId: 1, seqName: 1 }');
    } catch (err) {
      console.log('ℹ️  Index already exists or error:', err.message);
    }
    
    console.log('\nChecking final indexes...');
    const finalIndexes = await collection.indexes();
    console.log('Final indexes:', JSON.stringify(finalIndexes, null, 2));
    
    // Check for any documents with the old schema
    const oldSchemaDocs = await collection.find({ type: { $ne: null } }).toArray();
    if (oldSchemaDocs.length > 0) {
      console.log(`\n⚠️  Found ${oldSchemaDocs.length} documents with old schema (type/year fields)`);
      console.log('Sample:', JSON.stringify(oldSchemaDocs.slice(0, 2), null, 2));
      console.log('Note: These documents may need to be migrated or deleted.');
    } else {
      console.log('\n✅ No documents with old schema found');
    }
    
    console.log('\n✅ Done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixCounterIndexes();

