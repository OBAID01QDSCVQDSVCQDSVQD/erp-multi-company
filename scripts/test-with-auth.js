// Test TVA settings with authentication
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

async function testWithAuth() {
  try {
    console.log('🧪 Testing TVA Settings with Authentication...');
    console.log('📝 Instructions:');
    console.log('1. Open browser to http://localhost:3000');
    console.log('2. Login with your account');
    console.log('3. Go to http://localhost:3000/settings');
    console.log('4. Click on TVA tab');
    console.log('5. Try to change a setting and save');
    console.log('6. Check browser console for logs');
    console.log('7. Check server terminal for logs');
    
    console.log('\n🔍 Debugging steps:');
    console.log('- Check if you see "🚀 Starting TVA settings save..." in browser console');
    console.log('- Check if you see "🔧 TVA Settings API - PATCH request received" in server logs');
    console.log('- Check if tenantId is available in browser console');
    console.log('- Check if session exists in server logs');
    
    console.log('\n❌ Common issues:');
    console.log('- User not logged in (401 Unauthorized)');
    console.log('- Missing tenantId in browser');
    console.log('- Session expired');
    console.log('- Network connectivity issues');
    
    console.log('\n✅ Expected flow:');
    console.log('1. User changes TVA setting');
    console.log('2. Form submits with tenantId');
    console.log('3. API receives request with valid session');
    console.log('4. Settings updated in database');
    console.log('5. Success message shown to user');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testWithAuth();
