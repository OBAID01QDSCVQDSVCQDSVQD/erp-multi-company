const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('🔧 Configuration MongoDB Atlas...\n');

// Demander les informations MongoDB Atlas
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function setupMongoAtlas() {
  try {
    console.log('📋 Veuillez fournir les informations MongoDB Atlas:\n');
    
    const username = await askQuestion('Nom d\'utilisateur MongoDB Atlas: ');
    const password = await askQuestion('Mot de passe MongoDB Atlas: ');
    const cluster = await askQuestion('Nom du cluster (ex: cluster0): ');
    const projectId = await askQuestion('Project ID (optionnel): ');
    
    // Construire l'URI MongoDB Atlas
    // Format standard: cluster.mongodb.net
    let mongoUri = `mongodb+srv://${username}:${password}@${cluster}.mongodb.net/erp-multi-company?retryWrites=true&w=majority`;
    
    if (projectId) {
      mongoUri += `&projectId=${projectId}`;
    }
    
    console.log('\n🔗 URI MongoDB généré:');
    console.log(mongoUri.substring(0, 50) + '...');
    
    // Générer un secret sécurisé pour NextAuth
    const nextAuthSecret = crypto.randomBytes(32).toString('base64');
    
    // Créer le fichier .env.local
    const envContent = `# Base de données MongoDB Atlas
MONGODB_URI=${mongoUri}

# NextAuth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=${nextAuthSecret}

# Configuration de l'application
NEXT_PUBLIC_APP_NAME=ERP Multi-Entreprises
NEXT_PUBLIC_APP_VERSION=1.0.0`;
    
    fs.writeFileSync('.env.local', envContent);
    console.log('\n✅ Fichier .env.local créé avec succès');
    
    console.log('\n📋 Prochaines étapes:');
    console.log('1. Vérifiez que votre IP est autorisée dans MongoDB Atlas');
    console.log('2. Vérifiez que l\'utilisateur a les permissions de lecture/écriture');
    console.log('3. Testez la connexion avec: npm run test-mongo');
    console.log('4. Lancez l\'application avec: npm run dev');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    rl.close();
  }
}

setupMongoAtlas();

