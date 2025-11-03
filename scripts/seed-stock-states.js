const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const StockStateSchema = new mongoose.Schema({ code: { type: String, unique: true }, libelle: String, actif: Boolean });
const StockState = mongoose.model('StockState', StockStateSchema);

const STATES = [
  { code: 'disponible', libelle: 'Disponible', actif: true },
  { code: 'reserve', libelle: 'Réservé', actif: true },
  { code: 'endommage', libelle: 'Endommagé', actif: true },
  { code: 'quarantaine', libelle: 'Quarantaine', actif: true },
  { code: 'expire', libelle: 'Expiré', actif: true },
];

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/erp-multi-company';
  await mongoose.connect(uri);
  await StockState.bulkWrite(STATES.map(s => ({ updateOne: { filter: { code: s.code }, update: { $set: s }, upsert: true } })));
  console.log('✅ Stock states seeded');
  await mongoose.disconnect();
}

run().catch((e)=>{ console.error(e); process.exit(1); });


