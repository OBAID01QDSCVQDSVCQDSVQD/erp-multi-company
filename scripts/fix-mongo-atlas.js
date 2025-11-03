const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function testMongoAtlasWithDifferentConfigs() {
  const originalUri = process.env.MONGODB_URI;
  console.log('🔧 Test de différentes configurations MongoDB Atlas...\n');
  
  const configs = [
    {
      name: 'Configuration originale',
      uri: originalUri
    },
    {
      name: 'Sans appName',
      uri: originalUri?.replace('?appName=Cluster0', '')
    },
    {
      name: 'Avec base de données spécifique',
      uri: originalUri?.replace('?appName=Cluster0', '/erp-multi-company?retryWrites=true&w=majority')
    },
    {
      name: 'Avec authSource',
      uri: originalUri?.replace('?appName=Cluster0', '/erp-multi-company?authSource=admin&retryWrites=true&w=majority')
    }
  ];

  for (const config of configs) {
    if (!config.uri) continue;
    
    console.log(`\n🧪 Test: ${config.name}`);
    console.log(`URI: ${config.uri.substring(0, 50)}...`);
    
    try {
      await mongoose.connect(config.uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });
      
      console.log('✅ Connexion réussie !');
      
      // Test ping
      const pingResult = await mongoose.connection.db.admin().ping();
      console.log('✅ Ping réussi');
      
      await mongoose.disconnect();
      console.log('🎉 Cette configuration fonctionne !');
      
      // Mettre à jour le fichier .env.local
      const fs = require('fs');
      const envContent = `# Base de données MongoDB
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
      await mongoose.disconnect().catch(() => {});
    }
  }
  
  console.log('\n❌ Aucune configuration n\'a fonctionné');
  console.log('\n💡 Vérifiez:');
  console.log('   1. Vos identifiants MongoDB Atlas');
  console.log('   2. Que l\'IP est autorisée (0.0.0.0/0 pour tous)');
  console.log('   3. Que l\'utilisateur a les permissions de lecture/écriture');
  console.log('   4. Que le cluster est actif');
}

testMongoAtlasWithDifferentConfigs();

