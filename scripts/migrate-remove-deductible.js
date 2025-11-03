/*
  One-off migration to remove deprecated fields from TaxRate documents:
  - deductiblePctVentes
  - deductiblePctAchats

  Usage:
    node scripts/migrate-remove-deductible.js            # all tenants
    node scripts/migrate-remove-deductible.js --tenant=TENANT_ID
*/

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/erp-multi-company';
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  const args = process.argv.slice(2);
  const tenantArg = args.find(a => a.startsWith('--tenant='));
  const tenantId = tenantArg ? tenantArg.split('=')[1] : undefined;

  const filter = tenantId ? { tenantId } : {};
  const update = { $unset: { deductiblePctVentes: '', deductiblePctAchats: '' } };

  const result = await db.collection('taxrates').updateMany(filter, update);
  console.log(`✅ Removed deprecated fields from ${result.modifiedCount} TaxRate document(s).`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});


