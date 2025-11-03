/* Seed idempotent des unités globales */
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const GlobalUnitSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  libelle: { type: String, required: true },
  symbole: { type: String, required: true },
  categorie: { type: String, required: true },
  baseCategorie: { type: String, required: true },
  facteurVersBase: { type: Number, required: true },
  actif: { type: Boolean, default: true },
}, { timestamps: true });

const GlobalUnit = mongoose.models.GlobalUnit || mongoose.model('GlobalUnit', GlobalUnitSchema);

const GLOBAL_UNITS = [
  { code:'PIECE', libelle:'Pièce', symbole:'pc', categorie:'quantite', baseCategorie:'PIECE', facteurVersBase:1 },
  { code:'BOITE', libelle:'Boîte', symbole:'bx', categorie:'quantite', baseCategorie:'PIECE', facteurVersBase:10 },
  { code:'CARTON', libelle:'Carton', symbole:'ctn', categorie:'quantite', baseCategorie:'PIECE', facteurVersBase:20 },
  { code:'PALETTE', libelle:'Palette', symbole:'plt', categorie:'quantite', baseCategorie:'PIECE', facteurVersBase:600 },
  { code:'G',  libelle:'Gramme',     symbole:'g',  categorie:'poids', baseCategorie:'G',  facteurVersBase:1 },
  { code:'KG', libelle:'Kilogramme', symbole:'kg', categorie:'poids', baseCategorie:'G',  facteurVersBase:1000 },
  { code:'T',  libelle:'Tonne',      symbole:'t',  categorie:'poids', baseCategorie:'G',  facteurVersBase:1_000_000 },
  { code:'ML', libelle:'Millilitre', symbole:'ml', categorie:'volume', baseCategorie:'ML', facteurVersBase:1 },
  { code:'L',  libelle:'Litre',      symbole:'L',  categorie:'volume', baseCategorie:'ML', facteurVersBase:1000 },
  { code:'M3', libelle:'Mètre cube', symbole:'m³', categorie:'volume', baseCategorie:'ML', facteurVersBase:1_000_000 },
  { code:'MM', libelle:'Millimètre', symbole:'mm', categorie:'longueur', baseCategorie:'MM', facteurVersBase:1 },
  { code:'CM', libelle:'Centimètre', symbole:'cm', categorie:'longueur', baseCategorie:'MM', facteurVersBase:10 },
  { code:'M',  libelle:'Mètre',      symbole:'m',  categorie:'longueur', baseCategorie:'MM', facteurVersBase:1000 },
  { code:'CM2', libelle:'Centimètre carré', symbole:'cm²', categorie:'surface', baseCategorie:'CM2', facteurVersBase:1 },
  { code:'M2',  libelle:'Mètre carré',      symbole:'m²',  categorie:'surface', baseCategorie:'CM2', facteurVersBase:10_000 },
  { code:'MIN', libelle:'Minute', symbole:'min', categorie:'temps', baseCategorie:'MIN', facteurVersBase:1 },
  { code:'H',   libelle:'Heure',  symbole:'h',   categorie:'temps', baseCategorie:'MIN', facteurVersBase:60 },
  { code:'J',   libelle:'Jour',   symbole:'j',   categorie:'temps', baseCategorie:'MIN', facteurVersBase:60*8 },
];

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/erp-multi-company';
  await mongoose.connect(uri);
  const ops = GLOBAL_UNITS.map(u => ({
    updateOne: {
      filter: { code: u.code },
      update: { $set: u },
      upsert: true,
    }
  }));
  await GlobalUnit.bulkWrite(ops);
  console.log(`✅ Seeded ${GLOBAL_UNITS.length} global units.`);
  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });


