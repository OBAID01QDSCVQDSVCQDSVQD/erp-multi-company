const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

// Actual Schema from src/lib/models/Company.ts
const CompanySchema = new mongoose.Schema({
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true, uppercase: true },
    address: {
        street: { type: String, required: true },
        city: { type: String, required: true },
        postalCode: { type: String, required: true },
        country: { type: String, required: true },
    },
    contact: {
        email: { type: String, required: true },
        phone: { type: String, required: true },
        website: String,
    },
    fiscal: {
        taxNumber: String,
        registrationNumber: String,
        vatNumber: String,
    },
    settings: {
        currency: { type: String, default: 'TND' },
        timezone: { type: String, default: 'Africa/Tunis' },
        language: { type: String, default: 'fr' },
        dateFormat: { type: String, default: 'DD/MM/YYYY' },
    },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Actual Schema found in User code or inferred
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    role: { type: String, enum: ['admin', 'manager', 'user'], default: 'user' },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    permissions: [{ type: String }],
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

const Company = mongoose.model('Company', CompanySchema);
const User = mongoose.model('User', UserSchema);

async function createAdmin() {
    try {
        console.log('🚀 Starting Admin Creation...');
        if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI missing');

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // 1. Create Company
        const demoCompany = new Company({
            name: 'Entreprise Démo',
            code: 'DEMO',
            address: {
                street: '123 Avenue Habib Bourguiba',
                city: 'Tunis',
                postalCode: '1000',
                country: 'Tunisie'
            },
            contact: {
                email: 'contact@entreprise-demo.com',
                phone: '+216 71 123 456',
                website: 'www.demo.tn'
            },
            fiscal: {
                taxNumber: '1234567/A',
                registrationNumber: 'RC12345',
                vatNumber: 'TN1234567'
            },
            settings: {
                currency: 'TND',
                timezone: 'Africa/Tunis',
                language: 'fr'
            }
        });

        const savedCompany = await demoCompany.save();
        console.log(`✅ Company Created: ${savedCompany.name} (Code: ${savedCompany.code})`);

        // 2. Create Admin User
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const adminUser = new User({
            email: 'admin@entreprise-demo.com',
            password: hashedPassword,
            firstName: 'Super',
            lastName: 'Admin',
            role: 'admin',
            companyId: savedCompany._id,
            permissions: ['all'],
            isActive: true
        });

        await adminUser.save();
        console.log(`✅ Admin User Created: ${adminUser.email}`);
        console.log(`🔑 Password: admin123`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.code === 11000) {
            console.error('   (Duplicate key error - data might already exist)');
        }
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected');
    }
}

createAdmin();
