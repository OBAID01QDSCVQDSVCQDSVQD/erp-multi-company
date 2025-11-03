const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function testMongoConnection() {
  try {
    console.log('🔌 Test de connexion à MongoDB...\n');
    
    const mongoUri = process.env.MONGODB_URI;
    console.log('URI MongoDB:', mongoUri ? 'Configuré' : 'Non configuré');
    
    if (!mongoUri) {
      console.log('❌ MONGODB_URI non trouvé dans .env.local');
      return;
    }

    // Connexion à MongoDB
    console.log('Connexion en cours...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connexion à MongoDB Atlas réussie !');

    // Test de ping
    console.log('\n🏓 Test de ping...');
    const pingResult = await mongoose.connection.db.admin().ping();
    console.log('✅ Ping réussi:', pingResult);

    // Lister les bases de données
    console.log('\n📊 Bases de données disponibles:');
    const adminDb = mongoose.connection.db.admin();
    const dbs = await adminDb.listDatabases();
    dbs.databases.forEach(db => {
      console.log(`  - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });

    // Tester la création d'une collection
    console.log('\n🧪 Test de création de collection...');
    const testCollection = mongoose.connection.db.collection('test_connection');
    await testCollection.insertOne({ 
      test: true, 
      timestamp: new Date(),
      message: 'Test de connexion réussi'
    });
    console.log('✅ Document de test inséré');

    // Compter les documents
    const count = await testCollection.countDocuments();
    console.log(`📈 Nombre de documents dans test_connection: ${count}`);

    // Nettoyer le test
    await testCollection.drop();
    console.log('🧹 Collection de test supprimée');

    console.log('\n🎉 Test de connexion MongoDB complètement réussi !');

  } catch (error) {
    console.error('❌ Erreur de connexion MongoDB:', error.message);
    
    if (error.code === 8000) {
      console.log('\n💡 Suggestions:');
      console.log('  1. Vérifiez vos identifiants MongoDB Atlas');
      console.log('  2. Vérifiez que l\'IP est autorisée dans MongoDB Atlas');
      console.log('  3. Vérifiez que l\'utilisateur a les bonnes permissions');
    } else if (error.code === 'ENOTFOUND') {
      console.log('\n💡 Suggestions:');
      console.log('  1. Vérifiez votre connexion internet');
      console.log('  2. Vérifiez l\'URL de connexion MongoDB Atlas');
    }
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Connexion fermée');
    process.exit(0);
  }
}

// Exécuter le test
testMongoConnection();

