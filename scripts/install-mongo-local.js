const { exec } = require('child_process');
const fs = require('fs');

console.log('🚀 Installation de MongoDB local...\n');

// Vérifier si MongoDB est déjà installé
exec('mongod --version', (error, stdout, stderr) => {
  if (error) {
    console.log('❌ MongoDB n\'est pas installé');
    console.log('\n📋 Instructions d\'installation:');
    console.log('1. Téléchargez MongoDB Community Server:');
    console.log('   https://www.mongodb.com/try/download/community');
    console.log('\n2. Installez MongoDB');
    console.log('\n3. Démarrez MongoDB:');
    console.log('   mongod');
    console.log('\n4. Testez la connexion:');
    console.log('   npm run check-mongo');
  } else {
    console.log('✅ MongoDB est déjà installé');
    console.log('Version:', stdout.split('\n')[0]);
    
    // Tester la connexion
    console.log('\n🔍 Test de la connexion...');
    exec('mongosh --eval "db.runCommand(\'ping\')"', (error, stdout, stderr) => {
      if (error) {
        console.log('❌ MongoDB n\'est pas démarré');
        console.log('💡 Démarrez MongoDB avec: mongod');
      } else {
        console.log('✅ MongoDB fonctionne !');
        
        // Mettre à jour .env.local pour MongoDB local
        const envContent = `# Base de données MongoDB (Local)
MONGODB_URI=mongodb://localhost:27017/erp-multi-company

# NextAuth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=1OgP4bUmlbEvo0DpHcS1ctxnNGMi0KTn

# Configuration de l'application
NEXT_PUBLIC_APP_NAME=ERP Multi-Entreprises
NEXT_PUBLIC_APP_VERSION=1.0.0`;
        
        fs.writeFileSync('.env.local', envContent);
        console.log('✅ Fichier .env.local mis à jour pour MongoDB local');
        
        console.log('\n🎉 Prêt à utiliser MongoDB local !');
        console.log('💡 Lancez l\'application avec: npm run dev');
      }
    });
  }
});

