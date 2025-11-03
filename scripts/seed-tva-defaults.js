const mongoose = require('mongoose');
require('dotenv').config();

// Modèle TaxRate
const TaxRateSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    index: true,
  },
  code: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  libelle: {
    type: String,
    required: true,
    trim: true,
  },
  tauxPct: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  applicableA: {
    type: String,
    enum: ['ventes', 'achats', 'les_deux'],
    default: 'les_deux',
  },
  },
  dateEffet: {
    type: Date,
    default: Date.now,
  },
  actif: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

TaxRateSchema.index({ tenantId: 1, code: 1 }, { unique: true });
TaxRateSchema.index({ tenantId: 1, actif: 1 });

const TaxRate = mongoose.model('TaxRate', TaxRateSchema);

// Modèle CompanySettings (simplifié)
const CompanySettingsSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  tva: {
    tauxParDefautPct: { type: Number, default: 19 },
    regimeParDefautCode: { type: String, default: 'TN19' },
    arrondi: { 
      type: String, 
      enum: ['ligne', 'document'], 
      default: 'ligne' 
    },
    prixIncluentTVA: { type: Boolean, default: false },
    timbreFiscal: {
      actif: { type: Boolean, default: false },
      montantFixe: { type: Number, default: 1.0 },
    },
    retenueSource: {
      actif: { type: Boolean, default: false },
      tauxPct: { type: Number, default: 0 },
      appliquerSur: { 
        type: String, 
        enum: ['services', 'tous'], 
        default: 'services' 
      },
    },
  },
}, {
  timestamps: true,
});

const CompanySettings = mongoose.model('CompanySettings', CompanySettingsSchema);

// Taux de TVA par défaut pour la Tunisie
const defaultTaxRates = [
  { code: 'TN19', libelle: 'TVA 19%', tauxPct: 19, applicableA: 'les_deux' },
  { code: 'TN13', libelle: 'TVA 13%', tauxPct: 13, applicableA: 'les_deux' },
  { code: 'TN7', libelle: 'TVA 7%', tauxPct: 7, applicableA: 'les_deux' },
  { code: 'TN0', libelle: 'TVA 0%', tauxPct: 0, applicableA: 'les_deux' },
  { code: 'EXON', libelle: 'Exonéré', tauxPct: 0, applicableA: 'les_deux' },
];

// Paramètres TVA par défaut
const defaultTVASettings = {
  tauxParDefautPct: 19,
  regimeParDefautCode: 'TN19',
  arrondi: 'ligne',
  prixIncluentTVA: false,
  timbreFiscal: {
    actif: false,
    montantFixe: 1.0,
  },
  retenueSource: {
    actif: false,
    tauxPct: 0,
    appliquerSur: 'services',
  },
};

async function seedTVADefaults(tenantId) {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/erp-multi-company';
    await mongoose.connect(mongoUri);
    console.log('✅ Connecté à MongoDB');

    if (tenantId) {
      // Seed pour un tenant spécifique
      await seedForTenant(tenantId);
    } else {
      // Seed pour tous les tenants existants
      const tenants = await CompanySettings.distinct('tenantId');
      console.log(`📋 Trouvé ${tenants.length} tenants`);
      
      for (const tenant of tenants) {
        await seedForTenant(tenant);
      }
    }

    console.log('🎉 Seed TVA terminé avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur lors du seed TVA :', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
  }
}

async function seedForTenant(tenantId) {
  console.log(`\n🏢 Traitement du tenant: ${tenantId}`);

  // 1. Vérifier si des taux existent déjà
  const existingRates = await TaxRate.find({ tenantId });
  if (existingRates.length > 0) {
    console.log(`  ⚠️  ${existingRates.length} taux existants trouvés, skip...`);
    return;
  }

  // 2. Créer les taux de TVA
  const taxRates = await TaxRate.insertMany(
    defaultTaxRates.map(rate => ({
      ...rate,
      tenantId,
      dateEffet: new Date(),
      actif: true,
    }))
  );
  console.log(`  ✅ ${taxRates.length} taux de TVA créés`);

  // 3. Mettre à jour les paramètres TVA
  const settings = await CompanySettings.findOne({ tenantId });
  if (settings) {
    // Mettre à jour la section TVA
    await CompanySettings.findOneAndUpdate(
      { tenantId },
      { 
        $set: { 
          'tva.tauxParDefautPct': defaultTVASettings.tauxParDefautPct,
          'tva.regimeParDefautCode': defaultTVASettings.regimeParDefautCode,
          'tva.arrondi': defaultTVASettings.arrondi,
          'tva.prixIncluentTVA': defaultTVASettings.prixIncluentTVA,
          'tva.timbreFiscal': defaultTVASettings.timbreFiscal,
          'tva.retenueSource': defaultTVASettings.retenueSource,
        }
      }
    );
    console.log('  ✅ Paramètres TVA mis à jour');
  } else {
    // Créer les paramètres par défaut
    const newSettings = new CompanySettings({
      tenantId,
      tva: defaultTVASettings,
    });
    
    await newSettings.save();
    console.log('  ✅ Paramètres par défaut créés');
  }

  // 4. Afficher les taux créés
  console.log('  📋 Taux créés :');
  taxRates.forEach(rate => {
    console.log(`    ${rate.code} - ${rate.libelle} (${rate.tauxPct}%)`);
  });
}

// Exécuter le script
const args = process.argv.slice(2);
const tenantIdArg = args.find(arg => arg.startsWith('--tenant='));
const tenantId = tenantIdArg ? tenantIdArg.split('=')[1] : undefined;

seedTVADefaults(tenantId);
