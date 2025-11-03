const mongoose = require('mongoose');
require('dotenv').config();

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/erp-multi-company';

async function migrateDocuments() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connecté à MongoDB\n');

    const db = mongoose.connection.db;

    // Check if documents collection exists
    const collections = await db.listCollections().toArray();
    const hasDocuments = collections.some(c => c.name === 'documents');
    
    if (!hasDocuments) {
      console.log('⚠️  Collection "documents" introuvable');
      console.log('✅ Rien à migrer\n');
      return;
    }

    console.log('📋 Collections trouvées:');
    collections.forEach(c => console.log(`   - ${c.name}`));
    console.log('');

    // Count documents in old collection
    const count = await db.collection('documents').countDocuments();
    console.log(`📊 Trouvé ${count} document(s) dans "documents"\n`);

    if (count === 0) {
      console.log('✅ Rien à migrer\n');
      return;
    }

    // Get all documents
    const documents = await db.collection('documents').find({}).toArray();
    console.log(`📦 Copie de ${documents.length} document(s)...`);

    // Insert into devis collection
    const devisCollection = db.collection('devis');
    
    let inserted = 0;
    for (const doc of documents) {
      try {
        await devisCollection.insertOne(doc);
        inserted++;
        console.log(`   ✅ ${doc.numero} - ${doc.type}`);
      } catch (err) {
        if (err.code === 11000) {
          console.log(`   ⚠️  ${doc.numero} - déjà existant (skip)`);
        } else {
          console.log(`   ❌ ${doc.numero} - erreur:`, err.message);
        }
      }
    }

    console.log(`\n✅ ${inserted}/${documents.length} document(s) migré(s)`);
    
    // Optional: Rename old collection
    console.log('\n⚠️  Voulez-vous renommer "documents" en "documents_backup"?');
    console.log('   (Pour garder un backup au cas où)');
    console.log('   Command: db.documents.renameCollection("documents_backup")\n');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
    process.exit(0);
  }
}

migrateDocuments();

