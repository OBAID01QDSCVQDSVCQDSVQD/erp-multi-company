const mongoose = require('mongoose');
require('dotenv').config();

// Modèle GlobalExpenseCategory
const GlobalExpenseCategorySchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
  },
  nom: {
    type: String,
    required: true,
    trim: true,
  },
  typeGlobal: {
    type: String,
    enum: ['exploitation', 'consommable', 'investissement', 'financier', 'exceptionnel'],
    required: true,
    default: 'exploitation',
  },
  icone: {
    type: String,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

const GlobalExpenseCategory = mongoose.model('GlobalExpenseCategory', GlobalExpenseCategorySchema);

// Catégories par défaut
const defaultCategories = [
  // Exploitation
  { code: 'TRANSPORT', nom: 'Transport', icone: '🚗', typeGlobal: 'exploitation', description: 'Frais de transport et déplacement' },
  { code: 'TELECOM', nom: 'Télécommunications', icone: '📞', typeGlobal: 'exploitation', description: 'Téléphone, internet, communications' },
  { code: 'ENERGIE', nom: 'Énergie', icone: '⚡', typeGlobal: 'exploitation', description: 'Électricité, gaz, carburant' },
  { code: 'LOCAL', nom: 'Local', icone: '🏢', typeGlobal: 'exploitation', description: 'Loyer, charges, maintenance' },
  { code: 'ASSURANCE', nom: 'Assurance', icone: '🛡️', typeGlobal: 'exploitation', description: 'Assurances professionnelles' },
  { code: 'BANQUE', nom: 'Frais bancaires', icone: '🏦', typeGlobal: 'exploitation', description: 'Frais de tenue de compte, virements' },
  { code: 'COMPTA', nom: 'Comptabilité', icone: '📊', typeGlobal: 'exploitation', description: 'Expert-comptable, logiciels comptables' },
  { code: 'JURIDIQUE', nom: 'Juridique', icone: '⚖️', typeGlobal: 'exploitation', description: 'Avocat, conseil juridique' },
  { code: 'MARKETING', nom: 'Marketing', icone: '📢', typeGlobal: 'exploitation', description: 'Publicité, communication, marketing' },
  { code: 'FORMATION', nom: 'Formation', icone: '🎓', typeGlobal: 'exploitation', description: 'Formation du personnel' },
  
  // Consommables
  { code: 'FOURNITURES', nom: 'Fournitures de bureau', icone: '📝', typeGlobal: 'consommable', description: 'Papeterie, fournitures de bureau' },
  { code: 'MAINTENANCE', nom: 'Maintenance', icone: '🔧', typeGlobal: 'consommable', description: 'Maintenance et réparation' },
  { code: 'NETTOYAGE', nom: 'Nettoyage', icone: '🧽', typeGlobal: 'consommable', description: 'Produits de nettoyage' },
  { code: 'SECURITE', nom: 'Sécurité', icone: '🔒', typeGlobal: 'consommable', description: 'Équipements de sécurité' },
  
  // Investissement
  { code: 'MATERIEL', nom: 'Matériel informatique', icone: '💻', typeGlobal: 'investissement', description: 'Ordinateurs, serveurs, équipements IT' },
  { code: 'MOBILIER', nom: 'Mobilier', icone: '🪑', typeGlobal: 'investissement', description: 'Mobilier de bureau' },
  { code: 'VEHICULE', nom: 'Véhicule', icone: '🚙', typeGlobal: 'investissement', description: 'Achat de véhicule professionnel' },
  { code: 'EQUIPEMENT', nom: 'Équipement', icone: '⚙️', typeGlobal: 'investissement', description: 'Équipements de production' },
  
  // Financier
  { code: 'INTERET', nom: 'Intérêts', icone: '💰', typeGlobal: 'financier', description: 'Intérêts d\'emprunts' },
  { code: 'FRAIS_FIN', nom: 'Frais financiers', icone: '💳', typeGlobal: 'financier', description: 'Frais bancaires, commissions' },
  { code: 'DIVIDENDE', nom: 'Dividendes', icone: '📈', typeGlobal: 'financier', description: 'Dividendes versés' },
  
  // Exceptionnel
  { code: 'EXCEPTIONNEL', nom: 'Exceptionnel', icone: '⚠️', typeGlobal: 'exceptionnel', description: 'Dépenses exceptionnelles' },
  { code: 'PERTE', nom: 'Perte', icone: '📉', typeGlobal: 'exceptionnel', description: 'Pertes exceptionnelles' },
  { code: 'PROVISION', nom: 'Provision', icone: '📋', typeGlobal: 'exceptionnel', description: 'Provisions pour risques' },
];

async function seedGlobalCategories() {
  try {
    // Connexion à MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/erp-multi-company';
    await mongoose.connect(mongoUri);
    console.log('✅ Connecté à MongoDB');

    // Supprimer les catégories existantes
    await GlobalExpenseCategory.deleteMany({});
    console.log('🗑️ Anciennes catégories supprimées');

    // Créer les nouvelles catégories
    const categories = await GlobalExpenseCategory.insertMany(defaultCategories);
    console.log(`✅ ${categories.length} catégories globales créées`);

    // Afficher les catégories créées
    console.log('\n📋 Catégories créées :');
    categories.forEach(cat => {
      console.log(`  ${cat.icone} ${cat.nom} (${cat.code}) - ${cat.typeGlobal}`);
    });

    console.log('\n🎉 Seed terminé avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur lors du seed :', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
  }
}

// Exécuter le seed
seedGlobalCategories();
