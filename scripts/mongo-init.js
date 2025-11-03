// Script d'initialisation MongoDB
db = db.getSiblingDB('erp-multi-company');

// Créer un utilisateur pour l'application
db.createUser({
  user: 'erp_user',
  pwd: 'erp_password',
  roles: [
    {
      role: 'readWrite',
      db: 'erp-multi-company'
    }
  ]
});

// Créer les collections de base
db.createCollection('companies');
db.createCollection('users');
db.createCollection('products');
db.createCollection('customers');
db.createCollection('suppliers');
db.createCollection('invoices');

print('✅ Base de données ERP initialisée avec succès');
print('👤 Utilisateur créé: erp_user');
print('🔑 Mot de passe: erp_password');
print('📊 Collections créées: companies, users, products, customers, suppliers, invoices');

