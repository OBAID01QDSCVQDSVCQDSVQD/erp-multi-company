const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

// Import models
const CompanySchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: String,
  address: {
    street: String,
    city: String,
    postalCode: String,
    country: String
  },
  taxNumber: String,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  role: { type: String, enum: ['admin', 'manager', 'user'], default: 'user' },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  permissions: [{ type: String }],
  isActive: { type: Boolean, default: true },
  lastLogin: Date
}, { timestamps: true });

const Company = mongoose.model('Company', CompanySchema);
const User = mongoose.model('User', UserSchema);

async function testLogin() {
  try {
    console.log('🔐 Test de connexion...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connexion à MongoDB établie');
    
    // Test avec admin@entreprise-demo.com
    const email = 'admin@entreprise-demo.com';
    const password = 'admin123';
    
    console.log(`\n🧪 Test de connexion avec: ${email}`);
    
    const user = await User.findOne({ 
      email: email,
      isActive: true 
    }).populate('companyId');
    
    if (!user) {
      console.log('❌ Utilisateur non trouvé');
      return;
    }
    
    console.log('✅ Utilisateur trouvé:');
    console.log(`   Nom: ${user.firstName} ${user.lastName}`);
    console.log(`   Rôle: ${user.role}`);
    console.log(`   Actif: ${user.isActive}`);
    console.log(`   Entreprise: ${user.companyId ? user.companyId.name : 'N/A'}`);
    
    // Test du mot de passe
    console.log(`\n🔑 Test du mot de passe: ${password}`);
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log(`   Mot de passe valide: ${isPasswordValid ? '✅ OUI' : '❌ NON'}`);
    
    if (isPasswordValid) {
      console.log('\n🎉 Connexion réussie !');
      console.log('   Données utilisateur:');
      console.log(`   - ID: ${user._id}`);
      console.log(`   - Email: ${user.email}`);
      console.log(`   - Nom: ${user.firstName} ${user.lastName}`);
      console.log(`   - Rôle: ${user.role}`);
      console.log(`   - Company ID: ${user.companyId._id}`);
      console.log(`   - Company Name: ${user.companyId.name}`);
    } else {
      console.log('\n❌ Mot de passe incorrect');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Connexion fermée');
  }
}

testLogin();

