const mongoose = require('mongoose');

async function testLocalMongoConnection() {
  try {
    console.log('🔌 Test de connexion à MongoDB local...\n');
    
    // Connexion à MongoDB local
    const localUri = 'mongodb://localhost:27017/erp-multi-company';
    console.log('URI MongoDB Local:', localUri);
    
    console.log('Connexion en cours...');
    await mongoose.connect(localUri);
    console.log('✅ Connexion à MongoDB local réussie !');

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
      message: 'Test de connexion MongoDB local réussi'
    });
    console.log('✅ Document de test inséré');

    // Compter les documents
    const count = await testCollection.countDocuments();
    console.log(`📈 Nombre de documents dans test_connection: ${count}`);

    // Nettoyer le test
    await testCollection.drop();
    console.log('🧹 Collection de test supprimée');

    console.log('\n🎉 Test de connexion MongoDB local complètement réussi !');
    console.log('\n💡 Pour utiliser MongoDB local:');
    console.log('   1. Installez MongoDB localement');
    console.log('   2. Démarrez le service MongoDB');
    console.log('   3. Modifiez MONGODB_URI dans .env.local vers mongodb://localhost:27017/erp-multi-company');

  } catch (error) {
    console.error('❌ Erreur de connexion MongoDB local:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 MongoDB local n\'est pas démarré:');
      console.log('   1. Installez MongoDB: https://www.mongodb.com/try/download/community');
      console.log('   2. Démarrez le service: mongod');
      console.log('   3. Ou utilisez Docker: docker run -d -p 27017:27017 mongo');
    }
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Connexion fermée');
    process.exit(0);
  }
}

// Exécuter le test
testLocalMongoConnection();

