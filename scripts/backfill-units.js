/* Backfill par tenant: si aucune unité locale, créer les 6 par défaut */
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const CompanySettingsSchema = new mongoose.Schema({ tenantId: { type: String, unique: true } });
const CompanySettings = mongoose.model('CompanySettings', CompanySettingsSchema);

const UnitSchema = new mongoose.Schema({
  tenantId: String,
  code: String,
  libelle: String,
  symbole: String,
  categorie: String,
  baseCategorie: String,
  facteurVersBase: Number,
  actif: Boolean,
  estParDefaut: Boolean,
});
UnitSchema.index({ tenantId: 1, code: 1 }, { unique: true });
const Unit = mongoose.model('Unit', UnitSchema);

const defaults = [
  { code:'PIECE', libelle:'Pièce', symbole:'pc', categorie:'quantite', baseCategorie:'PIECE', facteurVersBase:1, estParDefaut:true },
  { code:'KG', libelle:'Kilogramme', symbole:'kg', categorie:'poids', baseCategorie:'G', facteurVersBase:1000, estParDefaut:true },
  { code:'L',  libelle:'Litre', symbole:'L', categorie:'volume', baseCategorie:'ML', facteurVersBase:1000, estParDefaut:true },
  { code:'M',  libelle:'Mètre', symbole:'m', categorie:'longueur', baseCategorie:'MM', facteurVersBase:1000, estParDefaut:true },
  { code:'M2', libelle:'Mètre carré', symbole:'m²', categorie:'surface', baseCategorie:'CM2', facteurVersBase:10000, estParDefaut:true },
  { code:'H',  libelle:'Heure', symbole:'h', categorie:'temps', baseCategorie:'MIN', facteurVersBase:60, estParDefaut:true },
];

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/erp-multi-company';
  await mongoose.connect(uri);
  const tenants = await CompanySettings.distinct('tenantId');
  console.log('Tenants:', tenants.length);
  for (const tenantId of tenants) {
    const count = await Unit.countDocuments({ tenantId });
    if (count === 0) {
      const docs = defaults.map(d => ({ ...d, tenantId, actif: true }));
      await Unit.insertMany(docs);
      console.log(`✅ Backfilled ${docs.length} units for tenant ${tenantId}`);
    }
  }
  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });


