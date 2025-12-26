
import mongoose from 'mongoose';
import WarrantyTemplate from './src/lib/models/WarrantyTemplate';
import Warranty from './src/lib/models/Warranty';

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/erp-multi-company"; // Adjust if needed

async function checkData() {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(MONGODB_URI);
    }

    console.log("Checking WarrantyTemplate...");
    const template = await (WarrantyTemplate as any).findOne({}).sort({ updatedAt: -1 });
    console.log("Latest Template:", template ? JSON.stringify(template.toJSON(), null, 2) : "None");

    console.log("Checking Warranty...");
    const warranties = await (Warranty as any).find({}).populate('templateId');
    if (warranties.length === 0) {
        console.log("No warranties found in DB.");
    } else {
        console.log(`Found ${warranties.length} warranties.`);
        warranties.forEach((w: any) => {
            console.log(`- ID: ${w._id}, Cert: ${w.certificateNumber}, Tenant: ${w.tenantId}, Template: ${w.templateId?.name}`);
        });
    }

    if (warranties.length > 0) {
        const warranty = warranties[0];
        if (!warranty.exclusiveAdvantages) {
            console.log("WARN: exclusiveAdvantages missing from Warranty model output (root).");
        }
    }

    process.exit();
}

checkData();
