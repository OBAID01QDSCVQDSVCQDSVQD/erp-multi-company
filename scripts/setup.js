const fs = require('fs');
const path = require('path');

console.log('🚀 Configuration de l\'ERP Multi-Entreprises...\n');

// Créer le fichier .env.local s'il n'existe pas
const envPath = path.join(__dirname, '..', '.env.local');
const envExamplePath = path.join(__dirname, '..', 'env.example');

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ Fichier .env.local créé à partir de env.example');
  } else {
    const envContent = `# Base de données MongoDB
MONGODB_URI=mongodb://localhost:27017/erp-multi-company

# NextAuth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# Configuration de l'application
NEXT_PUBLIC_APP_NAME=ERP Multi-Entreprises
NEXT_PUBLIC_APP_VERSION=1.0.0`;
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Fichier .env.local créé avec la configuration par défaut');
  }
} else {
  console.log('ℹ️  Fichier .env.local existe déjà');
}

// Vérifier si MongoDB est accessible
const { exec } = require('child_process');
exec('mongosh --eval "db.runCommand(\'ping\')"', (error, stdout, stderr) => {
  if (error) {
    console.log('⚠️  MongoDB ne semble pas être en cours d\'exécution');
    console.log('   Veuillez démarrer MongoDB avant de lancer l\'application');
  } else {
    console.log('✅ MongoDB est accessible');
  }
  
  console.log('\n🎉 Configuration terminée !');
  console.log('\n📋 Prochaines étapes :');
  console.log('   1. Modifiez le fichier .env.local selon vos besoins');
  console.log('   2. Assurez-vous que MongoDB est en cours d\'exécution');
  console.log('   3. Lancez l\'application avec : npm run dev');
  console.log('   4. Ouvrez http://localhost:3000 dans votre navigateur');
});
