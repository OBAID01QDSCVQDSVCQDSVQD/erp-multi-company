
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
    const warranty = await (Warranty as any).findOne({}).sort({ updatedAt: -1 }).populate('templateId');
    console.log("Latest Warranty:", warranty ? JSON.stringify(warranty.toJSON(), null, 2) : "None");

    // Check if exclusiveAdvantages exists in raw doc
    if (template && !template.exclusiveAdvantages) {
        console.log("WARN: exclusiveAdvantages missing from Template model output. Checking raw collection...");
        const rawTemplate = await mongoose.connection.collection('warrantytemplates').findOne({ _id: template._id });
        console.log("Raw Template exclusiveAdvantages:", rawTemplate?.exclusiveAdvantages);
    }

    if (warranty && !warranty.exclusiveAdvantages) {
        console.log("WARN: exclusiveAdvantages missing from Warranty model output (root).");
    }

    process.exit();
}

checkData();
