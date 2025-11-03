const mongoose = require('mongoose');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/erp-multi-company';

async function testSettings() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Import the model
    const CompanySettings = require('../src/lib/models/CompanySettings').default;

    // Check if settings exist for test-tenant
    const settings = await CompanySettings.findOne({ tenantId: 'test-tenant' });
    
    if (settings) {
      console.log('📋 Existing settings found:');
      console.log('TVA section:', settings.tva);
    } else {
      console.log('❌ No settings found for test-tenant');
    }

    // Test creating/updating TVA settings
    console.log('🔄 Testing TVA settings update...');
    
    const updateResult = await CompanySettings.findOneAndUpdate(
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
      },
      { new: true, upsert: true }
    );

    console.log('✅ TVA settings updated successfully:');
    console.log('TVA section:', updateResult.tva);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testSettings();
