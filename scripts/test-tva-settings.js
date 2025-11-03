const fetch = require('node-fetch');

async function testTVASettings() {
  try {
    console.log('🧪 Testing TVA Settings API...');
    
    // Test data
    const testData = {
      tauxParDefautPct: 19,
      regimeParDefautCode: 'TN19',
      arrondi: 'ligne',
      prixIncluentTVA: false,
      timbreFiscal: {
        actif: false,
        montantFixe: 1.0,
      },
      retenueSource: {
        actif: false,
        tauxPct: 0,
        appliquerSur: 'services',
      },
    };

    console.log('📤 Sending data:', testData);

    const response = await fetch('http://localhost:3000/api/settings/tva', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': 'test-tenant',
      },
      body: JSON.stringify(testData),
    });

    console.log('📥 Response status:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Success:', result);
    } else {
      const error = await response.json();
      console.log('❌ Error:', error);
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testTVASettings();
