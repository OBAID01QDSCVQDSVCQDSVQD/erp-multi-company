const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function testMongoAuth() {
  console.log('🔐 Test de l\'authentification MongoDB Atlas...\n');
  
  const baseUri = 'mongodb+srv://obaidessafil_db_user:AlRxbASDGLZhWAVL@cluster0.zx9lgam.mongodb.net';
  
  const configs = [
    {
      name: 'Configuration 1: Base simple',
      uri: baseUri
    },
    {
      name: 'Configuration 2: Avec base de données',
      uri: baseUri + '/erp-multi-company'
    },
    {
      name: 'Configuration 3: Avec retryWrites',
      uri: baseUri + '/erp-multi-company?retryWrites=true&w=majority'
    },
    {
      name: 'Configuration 4: Avec authSource',
      uri: baseUri + '/erp-multi-company?authSource=admin&retryWrites=true&w=majority'
    },
    {
      name: 'Configuration 5: Avec authMechanism',
      uri: baseUri + '/erp-multi-company?authMechanism=SCRAM-SHA-1&retryWrites=true&w=majority'
    }
  ];

  for (const config of configs) {
    console.log(`\n🧪 Test: ${config.name}`);
    console.log(`URI: ${config.uri.substring(0, 60)}...`);
    
    try {
      await mongoose.connect(config.uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });
      
      console.log('✅ Connexion réussie !');
      
      // Test ping
      const pingResult = await mongoose.connection.db.admin().ping();
      console.log('🏓 Ping:', pingResult.ok ? 'OK' : 'Échec');
      
      // Lister les bases de données
      const adminDb = mongoose.connection.db.admin();
      const dbs = await adminDb.listDatabases();
      console.log('📊 Bases de données:', dbs.databases.length);
      
      await mongoose.disconnect();
      console.log('🎉 Cette configuration fonctionne !');
      
      // Mettre à jour .env.local
      const fs = require('fs');
      const envContent = `# Base de données MongoDB Atlas
MONGODB_URI=${config.uri}

# NextAuth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=1OgP4bUmlbEvo0DpHcS1ctxnNGMi0KTn

# Configuration de l'application
NEXT_PUBLIC_APP_NAME=ERP Multi-Entreprises
NEXT_PUBLIC_APP_VERSION=1.0.0`;
      
      fs.writeFileSync('.env.local', envContent);
      console.log('✅ Fichier .env.local mis à jour');
      
      return; // Arrêter après le premier succès
      
    } catch (error) {
      console.log(`❌ Échec: ${error.message}`);
      try {
        await mongoose.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
    }
  }
  
  console.log('\n❌ Aucune configuration n\'a fonctionné');
  console.log('\n💡 Vérifiez dans MongoDB Atlas:');
  console.log('   1. Database Access - Utilisateur existe et a les bonnes permissions');
  console.log('   2. Network Access - Votre IP est autorisée (0.0.0.0/0 pour tous)');
  console.log('   3. Cluster Status - Le cluster est actif');
  console.log('   4. Mot de passe - Le mot de passe est correct');
}

testMongoAuth();

