// Test TVA settings save functionality
const https = require('https');
const http = require('http');

function makeRequest(url, options) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function testTVASave() {
  try {
    console.log('🧪 Testing TVA Settings Save...');
    
    // Test 1: Check if user is logged in by testing /api/settings
    console.log('\n1. Testing authentication...');
    const authResponse = await makeRequest('http://localhost:3000/api/settings', {
      method: 'GET',
      headers: {
        'X-Tenant-Id': 'test-tenant',
      }
    });
    
    console.log('Auth Status:', authResponse.status);
    if (authResponse.status === 401) {
      console.log('❌ User not logged in - This is the problem!');
      console.log('   Solution: Login first at http://localhost:3000');
      return;
    }
    
    // Test 2: Test TVA settings update
    console.log('\n2. Testing TVA settings update...');
    const tvaData = {
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
    
    const tvaResponse = await makeRequest('http://localhost:3000/api/settings/tva', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': 'test-tenant',
      },
      body: JSON.stringify(tvaData)
    });
    
    console.log('TVA Update Status:', tvaResponse.status);
    if (tvaResponse.status === 200) {
      console.log('✅ TVA settings updated successfully');
      console.log('Response:', tvaResponse.data);
    } else {
      console.log('❌ TVA settings update failed');
      console.log('Error:', tvaResponse.data);
    }
    
    // Test 3: Verify the update
    console.log('\n3. Verifying the update...');
    const verifyResponse = await makeRequest('http://localhost:3000/api/settings', {
      method: 'GET',
      headers: {
        'X-Tenant-Id': 'test-tenant',
      }
    });
    
    if (verifyResponse.status === 200) {
      console.log('✅ Settings retrieved successfully');
      console.log('TVA section:', verifyResponse.data.tva);
    } else {
      console.log('❌ Failed to retrieve settings');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testTVASave();
