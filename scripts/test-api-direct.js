// Test API directly using fetch
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
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
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

async function testAPI() {
  try {
    console.log('🧪 Testing API endpoints...');
    
    // Test GET /api/settings
    console.log('\n1. Testing GET /api/settings...');
    const settingsResponse = await makeRequest('http://localhost:3000/api/settings', {
      method: 'GET',
      headers: {
        'X-Tenant-Id': 'test-tenant',
      }
    });
    
    console.log('Status:', settingsResponse.status);
    if (settingsResponse.status === 401) {
      console.log('❌ Unauthorized - User not logged in');
    } else if (settingsResponse.status === 200) {
      console.log('✅ Settings loaded successfully');
      console.log('TVA section exists:', !!settingsResponse.data.tva);
    } else {
      console.log('Response:', settingsResponse.data);
    }
    
    // Test PATCH /api/settings/tva
    console.log('\n2. Testing PATCH /api/settings/tva...');
    const tvaData = {
      tauxParDefautPct: 19,
      regimeParDefautCode: 'TN19',
      arrondi: 'ligne',
      prixIncluentTVA: false,
    };
    
    const tvaResponse = await makeRequest('http://localhost:3000/api/settings/tva', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': 'test-tenant',
      },
      body: JSON.stringify(tvaData)
    });
    
    console.log('Status:', tvaResponse.status);
    if (tvaResponse.status === 401) {
      console.log('❌ Unauthorized - User not logged in');
    } else if (tvaResponse.status === 200) {
      console.log('✅ TVA settings updated successfully');
    } else {
      console.log('Response:', tvaResponse.data);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAPI();
