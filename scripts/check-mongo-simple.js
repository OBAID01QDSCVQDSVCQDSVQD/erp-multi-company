const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function checkMongoConnection() {
  console.log('🔍 Vérification de la connexion MongoDB...\n');
  
  const mongoUri = process.env.MONGODB_URI;
  console.log('📋 URI MongoDB:', mongoUri ? '✅ Configuré' : '❌ Non configuré');
  
  if (!mongoUri) {
    console.log('❌ MONGODB_URI non trouvé dans .env.local');
    return;
  }

  console.log('🔗 URI:', mongoUri.substring(0, 30) + '...');
  
  try {
    console.log('\n⏳ Tentative de connexion...');
    
    // Connexion avec timeout court
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    
    console.log('✅ Connexion réussie !');
    
    // Test simple
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('📊 Collections trouvées:', collections.length);
    
    // Test ping
    const pingResult = await db.admin().ping();
    console.log('🏓 Ping:', pingResult.ok ? '✅ OK' : '❌ Échec');
    
    console.log('\n🎉 MongoDB fonctionne parfaitement !');
    
  } catch (error) {
    console.log('❌ Erreur de connexion:');
    console.log('   Type:', error.name);
    console.log('   Message:', error.message);
    
    if (error.code === 8000) {
      console.log('\n💡 Problème d\'authentification:');
      console.log('   - Vérifiez nom d\'utilisateur/mot de passe');
      console.log('   - Vérifiez les permissions dans MongoDB Atlas');
    } else if (error.code === 'ENOTFOUND') {
      console.log('\n💡 Problème de réseau:');
      console.log('   - Vérifiez votre connexion internet');
      console.log('   - Vérifiez l\'URL de connexion');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 MongoDB non accessible:');
      console.log('   - MongoDB n\'est pas démarré');
      console.log('   - Port 27017 bloqué');
    }
  } finally {
    try {
      await mongoose.disconnect();
      console.log('\n🔌 Connexion fermée');
    } catch (e) {
      // Ignore disconnect errors
    }
  }
}

checkMongoConnection();

