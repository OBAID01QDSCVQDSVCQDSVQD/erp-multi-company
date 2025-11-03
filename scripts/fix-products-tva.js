const mongoose = require('mongoose');
require('dotenv').config();

// Connexion à MongoDB
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/erp-multi-company';

// Schéma TaxRate
const TaxRateSchema = new mongoose.Schema({
  tenantId: String,
  code: String,
  libelle: String,
  tauxPct: Number,
  actif: Boolean,
}, { timestamps: true });

const TaxRate = mongoose.model('TaxRate', TaxRateSchema);

// Schéma Product
const ProductSchema = new mongoose.Schema({
  tenantId: String,
  sku: String,
  nom: String,
  taxCode: String,
  tvaPct: Number,
  prixVenteHT: Number,
}, { timestamps: true });

const Product = mongoose.model('Product', ProductSchema);

async function fixProductsTVA() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connecté à MongoDB\n');

    // Récupérer tous les tenants
    const tenants = await Product.distinct('tenantId');
    console.log(`📋 Trouvé ${tenants.length} tenant(s)\n`);

    for (const tenantId of tenants) {
      console.log(`🏢 Traitement du tenant: ${tenantId}`);
      
      // Récupérer les taux de TVA pour ce tenant
      const taxRates = await TaxRate.find({ tenantId, actif: true });
      console.log(`  📊 ${taxRates.length} taux de TVA trouvés`);
      
      // Créer une map code -> tauxPct
      const taxMap = {};
      taxRates.forEach(rate => {
        taxMap[rate.code] = rate.tauxPct;
      });
      
      // Trouver tous les produits sans tvaPct mais avec taxCode
      const products = await Product.find({ 
        tenantId, 
        taxCode: { $exists: true, $ne: null, $ne: '' },
        $or: [
          { tvaPct: { $exists: false } },
          { tvaPct: null }
        ]
      });
      
      console.log(`  📦 ${products.length} produits à mettre à jour`);
      
      let updated = 0;
      for (const product of products) {
        if (product.taxCode && taxMap[product.taxCode] !== undefined) {
          await Product.updateOne(
            { _id: product._id },
            { $set: { tvaPct: taxMap[product.taxCode] } }
          );
          updated++;
          console.log(`    ✅ ${product.nom} (${product.taxCode}): ${taxMap[product.taxCode]}%`);
        } else {
          console.log(`    ⚠️  ${product.nom}: code TVA "${product.taxCode}" non trouvé`);
        }
      }
      
      console.log(`  ✅ ${updated}/${products.length} produits mis à jour\n`);
    }

    console.log('🎉 Mise à jour terminée !');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
    process.exit(0);
  }
}

fixProductsTVA();

