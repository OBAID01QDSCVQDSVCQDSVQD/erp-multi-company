// Test script to check quote page functionality
console.log('🧪 Testing Quote Page...\n');

// Check if we can access the page
fetch('/sales/quotes')
  .then(response => {
    console.log('✅ Quotes page accessible');
    console.log('Status:', response.status);
  })
  .catch(error => {
    console.error('❌ Error accessing quotes page:', error);
  });

console.log('\n📋 Available quote IDs in database:');
console.log('Run this in your MongoDB shell:');
console.log('db.documents.find({ type: "DEVIS" }, { _id: 1, numero: 1 }).limit(5)');

