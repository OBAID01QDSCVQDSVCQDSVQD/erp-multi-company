const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

// Company Schema
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

// User Schema
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

async function createSdkAdmin() {
    try {
        console.log('🚀 Starting SDK Admin Creation...');
        if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI missing');

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // 1. Create Company "SDK Batiment"
        const companyData = {
            name: 'SDK Batiment',
            code: 'SDK',
            address: {
                street: 'Bureau central',
                city: 'Tunis',
                postalCode: '1000',
                country: 'Tunisie'
            },
            contact: {
                email: 'contact@sdkbatiment.com',
                phone: '+216 00 000 000',
                website: 'www.sdkbatiment.com'
            },
            settings: {
                currency: 'TND',
                timezone: 'Africa/Tunis',
                language: 'fr'
            }
        };

        // Check if company exists (by code or email) just in case, though DB was cleared
        let company = await Company.findOne({ code: 'SDK' });
        if (!company) {
            company = new Company(companyData);
            await company.save();
            console.log(`✅ Company Created: ${company.name}`);
        } else {
            console.log(`ℹ️  Company already exists: ${company.name}`);
        }

        // 2. Create Admin User
        const email = 'contact@sdkbatiment.com';
        const password = 'admin123'; // Default password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Check if user exists
        let user = await User.findOne({ email });
        if (user) {
            console.log('ℹ️  User already exists. Updating password/role...');
            user.password = hashedPassword;
            user.role = 'admin';
            user.companyId = company._id;
            await user.save();
            console.log('✅ User updated.');
        } else {
            user = new User({
                email,
                password: hashedPassword,
                firstName: 'Super',
                lastName: 'Admin',
                role: 'admin',
                companyId: company._id,
                permissions: ['all'],
                isActive: true
            });
            await user.save();
            console.log(`✅ User Created: ${user.email}`);
        }

        console.log('\n🔐 Credentials:');
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${password}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected');
    }
}

createSdkAdmin();
