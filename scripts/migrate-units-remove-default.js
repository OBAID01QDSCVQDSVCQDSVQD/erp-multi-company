/* Migration: remove estParDefaut from all units */
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/erp-multi-company';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const result = await db.collection('units').updateMany({}, { $unset: { estParDefaut: '' } });
  console.log(`✅ Removed estParDefaut from ${result.modifiedCount} unit(s).`);
  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });


