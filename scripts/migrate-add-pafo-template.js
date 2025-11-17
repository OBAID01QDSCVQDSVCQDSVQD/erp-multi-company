const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const CompanySettingsSchema = new mongoose.Schema({
  tenantId: String,
  numerotation: {
    devis: String,
    bc: String,
    bl: String,
    fac: String,
    avoir: String,
    ca: String,
    br: String,
    facfo: String,
    avoirfo: String,
    pafo: String,
  },
}, { strict: false });

const CompanySettings = mongoose.models.CompanySettings || mongoose.model('CompanySettings', CompanySettingsSchema);

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all company settings
    const settings = await CompanySettings.find({});
    console.log(`Found ${settings.length} company settings`);

    let updated = 0;
    for (const setting of settings) {
      // Check if pafo template exists
      if (!setting.numerotation || !setting.numerotation.pafo) {
        // Add default pafo template
        if (!setting.numerotation) {
          setting.numerotation = {};
        }
        setting.numerotation.pafo = 'PAFO-{{YYYY}}-{{SEQ:5}}';
        await setting.save();
        updated++;
        console.log(`Updated settings for tenant: ${setting.tenantId}`);
      }
    }

    console.log(`Migration completed. Updated ${updated} settings.`);
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrate();





