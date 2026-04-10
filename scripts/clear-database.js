const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const CompanySchema = new mongoose.Schema({
    name: String,
    code: String
}, { strict: false });

const Company = mongoose.model('Company', CompanySchema);

// User schema to verify/delete users if needed
const UserSchema = new mongoose.Schema({
    email: String
}, { strict: false });
const User = mongoose.model('User', UserSchema);

async function clearDatabase() {
    try {
        console.log('🗑️  Starting cleanup...\n');

        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is missing in .env.local');
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // 1. Delete all companies
        const deleteCompanies = await Company.deleteMany({});
        console.log(`\n🏢 Companies deleted: ${deleteCompanies.deletedCount}`);

        // 2. Delete all users (optional, ensuring clean slate as requested)
        const deleteUsers = await User.deleteMany({});
        console.log(`👤 Users deleted: ${deleteUsers.deletedCount}`);

        console.log('\n✨ Database is now clean of Companies and Users.');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Connection closed');
    }
}

clearDatabase();
