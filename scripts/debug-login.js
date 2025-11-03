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

async function debugLogin() {
  try {
    console.log('🔍 Debug de la connexion...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connexion à MongoDB établie');
    
    const email = 'admin@entreprise-demo.com';
    const password = 'admin123';
    
    console.log(`\n🧪 Test avec: ${email}`);
    
    // Test 1: Recherche exacte
    console.log('\n1. Recherche exacte:');
    const user1 = await User.findOne({ email: email });
    console.log('   Résultat:', user1 ? 'TROUVÉ' : 'NON TROUVÉ');
    
    // Test 2: Recherche avec toLowerCase
    console.log('\n2. Recherche avec toLowerCase:');
    const user2 = await User.findOne({ email: email.toLowerCase() });
    console.log('   Résultat:', user2 ? 'TROUVÉ' : 'NON TROUVÉ');
    
    // Test 3: Recherche avec trim
    console.log('\n3. Recherche avec trim:');
    const user3 = await User.findOne({ email: email.trim() });
    console.log('   Résultat:', user3 ? 'TROUVÉ' : 'NON TROUVÉ');
    
    // Test 4: Recherche avec toLowerCase et trim
    console.log('\n4. Recherche avec toLowerCase et trim:');
    const user4 = await User.findOne({ email: email.toLowerCase().trim() });
    console.log('   Résultat:', user4 ? 'TROUVÉ' : 'NON TROUVÉ');
    
    // Test 5: Recherche avec isActive
    console.log('\n5. Recherche avec isActive:');
    const user5 = await User.findOne({ 
      email: email.toLowerCase().trim(),
      isActive: true 
    });
    console.log('   Résultat:', user5 ? 'TROUVÉ' : 'NON TROUVÉ');
    
    // Test 6: Recherche avec populate
    console.log('\n6. Recherche avec populate:');
    const user6 = await User.findOne({ 
      email: email.toLowerCase().trim(),
      isActive: true 
    }).populate('companyId');
    console.log('   Résultat:', user6 ? 'TROUVÉ' : 'NON TROUVÉ');
    
    if (user6) {
      console.log('\n✅ Utilisateur trouvé:');
      console.log('   Email:', user6.email);
      console.log('   Nom:', user6.firstName, user6.lastName);
      console.log('   Rôle:', user6.role);
      console.log('   Actif:', user6.isActive);
      console.log('   Entreprise:', user6.companyId ? user6.companyId.name : 'N/A');
      
      // Test du mot de passe
      console.log('\n🔑 Test du mot de passe:');
      const isPasswordValid = await bcrypt.compare(password, user6.password);
      console.log('   Mot de passe valide:', isPasswordValid ? 'OUI' : 'NON');
      
      if (isPasswordValid) {
        console.log('\n🎉 Connexion réussie !');
      } else {
        console.log('\n❌ Mot de passe incorrect');
      }
    } else {
      console.log('\n❌ Utilisateur non trouvé');
      
      // Lister tous les utilisateurs
      console.log('\n📋 Tous les utilisateurs:');
      const allUsers = await User.find({});
      allUsers.forEach((u, i) => {
        console.log(`   ${i + 1}. ${u.email} (${u.firstName} ${u.lastName})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Connexion fermée');
  }
}

debugLogin();

