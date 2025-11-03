// Test script to fix TVA settings issue
const mongoose = require('mongoose');

// Use the same MongoDB URI as the app
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://erpuser:erppass123@erpcluster.abc123.mongodb.net/erp-multi-company?retryWrites=true&w=majority';

async function fixTVASettings() {
  try {
    console.log('🔌 Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');

    // Define the schema inline
    const CompanySettingsSchema = new mongoose.Schema({
      tenantId: { type: String, required: true, unique: true },
      societe: {
        nom: String,
        adresse: {
          rue: String,
          ville: String,
          codePostal: String,
          pays: String,
        },
        tva: String,
        devise: String,
        langue: String,
        fuseau: String,
      },
      numerotation: {
        devis: String,
        bl: String,
        facture: String,
        avoir: String,
      },
      ventes: {
        tvaParDefautPct: Number,
        conditionsPaiementDefaut: String,
        uniteParDefaut: String,
      },
      achats: {
        modesReglement: [String],
      },
      depenses: {
        politiqueValidation: {
          autoJusqua: Number,
          approbationRequiseAuDela: Number,
        },
      },
      stock: {
        methodeValorisation: String,
        seuilAlerte: Number,
      },
      securite: {
        motDePasseComplexe: Boolean,
        deuxFA: Boolean,
      },
      systeme: {
        maintenance: Boolean,
        version: String,
      },
      tva: {
        tauxParDefautPct: Number,
        regimeParDefautCode: String,
        arrondi: String,
        prixIncluentTVA: Boolean,
        timbreFiscal: {
          actif: Boolean,
          montantFixe: Number,
        },
        retenueSource: {
          actif: Boolean,
          tauxPct: Number,
          appliquerSur: String,
        },
      },
    }, { timestamps: true });

    const CompanySettings = mongoose.models.CompanySettings || mongoose.model('CompanySettings', CompanySettingsSchema);

    // Check existing settings
    const existingSettings = await CompanySettings.findOne({ tenantId: 'test-tenant' });
    
    if (existingSettings) {
      console.log('📋 Existing settings found:');
      console.log('TVA section exists:', !!existingSettings.tva);
      
      if (existingSettings.tva) {
        console.log('TVA settings:', existingSettings.tva);
      } else {
        console.log('❌ TVA section missing, adding it...');
        
        // Add TVA section to existing settings
        await CompanySettings.findOneAndUpdate(
          { tenantId: 'test-tenant' },
          {
            $set: {
              'tva.tauxParDefautPct': 19,
              'tva.regimeParDefautCode': 'TN19',
              'tva.arrondi': 'ligne',
              'tva.prixIncluentTVA': false,
              'tva.timbreFiscal.actif': false,
              'tva.timbreFiscal.montantFixe': 1.0,
              'tva.retenueSource.actif': false,
              'tva.retenueSource.tauxPct': 0,
              'tva.retenueSource.appliquerSur': 'services',
            }
          }
        );
        
        console.log('✅ TVA section added successfully');
      }
    } else {
      console.log('❌ No settings found for test-tenant');
    }

    // Test updating TVA settings
    console.log('🔄 Testing TVA settings update...');
    
    const updateResult = await CompanySettings.findOneAndUpdate(
      { tenantId: 'test-tenant' },
      { 
        $set: {
          'tva.tauxParDefautPct': 20,
          'tva.regimeParDefautCode': 'TN20',
          'tva.arrondi': 'document',
          'tva.prixIncluentTVA': true,
        }
      },
      { new: true, upsert: true }
    );

    console.log('✅ TVA settings updated successfully:');
    console.log('Updated TVA section:', updateResult.tva);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

fixTVASettings();
