const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

// Import models
const Company = require('../src/lib/models/Company');
const User = require('../src/lib/models/User');

async function seedDatabase() {
  try {
    console.log('🌱 Initialisation de la base de données...\n');

    // Connexion à MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/erp-multi-company');
    console.log('✅ Connexion à MongoDB établie');

    // Vérifier si des données existent déjà
    const existingUsers = await User.countDocuments();
    const existingCompanies = await Company.countDocuments();

    if (existingUsers > 0 || existingCompanies > 0) {
      console.log('⚠️  Des données existent déjà dans la base de données');
      console.log(`   Utilisateurs: ${existingUsers}`);
      console.log(`   Entreprises: ${existingCompanies}`);
      
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise((resolve) => {
        rl.question('Voulez-vous continuer et ajouter des données de test ? (y/N): ', resolve);
      });
      
      rl.close();

      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('❌ Opération annulée');
        process.exit(0);
      }
    }

    // Créer une entreprise par défaut
    console.log('\n🏢 Création de l\'entreprise par défaut...');
    const defaultCompany = new Company({
      name: 'Entreprise Démo',
      email: 'contact@entreprise-demo.com',
      phone: '+33 1 23 45 67 89',
      address: {
        street: '123 Rue de la Paix',
        city: 'Paris',
        postalCode: '75001',
        country: 'France'
      },
      taxNumber: 'FR12345678901',
      isActive: true
    });

    await defaultCompany.save();
    console.log('✅ Entreprise par défaut créée:', defaultCompany.name);

    // Créer un utilisateur administrateur par défaut
    console.log('\n👤 Création de l\'utilisateur administrateur...');
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    const adminUser = new User({
      email: 'admin@entreprise-demo.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'Système',
      role: 'admin',
      permissions: ['all'],
      companyId: defaultCompany._id,
      isActive: true
    });

    await adminUser.save();
    console.log('✅ Utilisateur administrateur créé:');
    console.log(`   Email: admin@entreprise-demo.com`);
    console.log(`   Mot de passe: admin123`);
    console.log(`   Rôle: admin`);

    // Créer un utilisateur manager de test
    console.log('\n👥 Création d\'un utilisateur manager...');
    const managerPassword = await bcrypt.hash('manager123', 12);
    
    const managerUser = new User({
      email: 'manager@entreprise-demo.com',
      password: managerPassword,
      firstName: 'Manager',
      lastName: 'Test',
      role: 'manager',
      permissions: ['products', 'customers', 'invoices', 'reports'],
      companyId: defaultCompany._id,
      isActive: true
    });

    await managerUser.save();
    console.log('✅ Utilisateur manager créé:');
    console.log(`   Email: manager@entreprise-demo.com`);
    console.log(`   Mot de passe: manager123`);
    console.log(`   Rôle: manager`);

    // Créer un utilisateur normal de test
    console.log('\n👤 Création d\'un utilisateur standard...');
    const userPassword = await bcrypt.hash('user123', 12);
    
    const normalUser = new User({
      email: 'user@entreprise-demo.com',
      password: userPassword,
      firstName: 'Utilisateur',
      lastName: 'Standard',
      role: 'user',
      permissions: ['products', 'customers'],
      companyId: defaultCompany._id,
      isActive: true
    });

    await normalUser.save();
    console.log('✅ Utilisateur standard créé:');
    console.log(`   Email: user@entreprise-demo.com`);
    console.log(`   Mot de passe: user123`);
    console.log(`   Rôle: user`);

    console.log('\n🎉 Base de données initialisée avec succès !');
    console.log('\n📋 Comptes de test créés :');
    console.log('   🔑 Administrateur: admin@entreprise-demo.com / admin123');
    console.log('   👔 Manager: manager@entreprise-demo.com / manager123');
    console.log('   👤 Utilisateur: user@entreprise-demo.com / user123');
    console.log('\n🚀 Vous pouvez maintenant vous connecter à l\'application !');

  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Connexion à MongoDB fermée');
    process.exit(0);
  }
}

// Exécuter le script
seedDatabase();
