const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

// Simplified Company Schema matching the one in the DB likely
const CompanySchema = new mongoose.Schema({
    name: String,
    code: String,
    contact: {
        email: String,
        phone: String
    },
    isActive: { type: Boolean, default: true }
}, { strict: false }); // strict: false to grab all fields even if not defined here

const Company = mongoose.model('Company', CompanySchema);

async function checkCompanies() {
    try {
        console.log('🔍 Checking companies...\n');

        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is missing in .env.local');
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // List all companies
        const companies = await Company.find({});
        console.log(`\n📊 Number of companies found: ${companies.length}`);

        companies.forEach((company, index) => {
            console.log(`\n🏢 Company ${index + 1}:`);
            console.log(`   ID: ${company._id}`);
            console.log(`   Name: ${company.name}`);
            console.log(`   Code: ${company.code}`);
            console.log(`   Email: ${company.contact ? company.contact.email : 'N/A'}`);
            console.log(`   Active: ${company.isActive}`);
            // Also check if 'email' exists at top level (old schema?)
            if (company.toObject().email) console.log(`   (Top level email): ${company.toObject().email}`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Connection closed');
    }
}

checkCompanies();
