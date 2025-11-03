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

async function checkUsers() {
  try {
    console.log('🔍 Vérification des utilisateurs...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connexion à MongoDB établie');
    
    // Lister tous les utilisateurs
    const users = await User.find({}).populate('companyId', 'name');
    console.log(`\n📊 Nombre d'utilisateurs trouvés: ${users.length}`);
    
    users.forEach((user, index) => {
      console.log(`\n👤 Utilisateur ${index + 1}:`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Nom: ${user.firstName} ${user.lastName}`);
      console.log(`   Rôle: ${user.role}`);
      console.log(`   Actif: ${user.isActive}`);
      console.log(`   Entreprise: ${user.companyId ? user.companyId.name : 'N/A'}`);
      console.log(`   Créé: ${user.createdAt}`);
    });
    
    // Tester la connexion avec admin@entreprise-demo.com
    console.log('\n🧪 Test de connexion avec admin@entreprise-demo.com...');
    const adminUser = await User.findOne({ email: 'admin@entreprise-demo.com' });
    
    if (adminUser) {
      console.log('✅ Utilisateur admin trouvé');
      console.log(`   Mot de passe hashé: ${adminUser.password.substring(0, 20)}...`);
      
      // Tester le mot de passe
      const isPasswordValid = await bcrypt.compare('admin123', adminUser.password);
      console.log(`   Mot de passe 'admin123' valide: ${isPasswordValid ? '✅ OUI' : '❌ NON'}`);
      
      // Tester d'autres mots de passe
      const testPasswords = ['admin', 'password', '123456', 'admin123'];
      for (const pwd of testPasswords) {
        const isValid = await bcrypt.compare(pwd, adminUser.password);
        console.log(`   Mot de passe '${pwd}' valide: ${isValid ? '✅ OUI' : '❌ NON'}`);
      }
    } else {
      console.log('❌ Utilisateur admin non trouvé');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Connexion fermée');
  }
}

checkUsers();

