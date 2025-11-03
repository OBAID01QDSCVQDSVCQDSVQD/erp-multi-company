const fetch = require('node-fetch');

async function testNextAuth() {
  try {
    console.log('🔐 Test de NextAuth...\n');
    
    const baseUrl = 'http://localhost:3000';
    
    // Test 1: Vérifier que l'API NextAuth fonctionne
    console.log('1. Test de l\'API NextAuth...');
    try {
      const response = await fetch(`${baseUrl}/api/auth/session`);
      const session = await response.json();
      console.log('   Session actuelle:', session);
    } catch (error) {
      console.log('   Erreur API NextAuth:', error.message);
    }
    
    // Test 2: Test de connexion avec fetch
    console.log('\n2. Test de connexion...');
    const loginData = {
      email: 'admin@entreprise-demo.com',
      password: 'admin123'
    };
    
    try {
      const response = await fetch(`${baseUrl}/api/auth/signin/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: loginData.email,
          password: loginData.password,
          callbackUrl: '/dashboard'
        })
      });
      
      console.log('   Status:', response.status);
      console.log('   Headers:', Object.fromEntries(response.headers.entries()));
      
      const text = await response.text();
      console.log('   Response:', text.substring(0, 200) + '...');
      
    } catch (error) {
      console.log('   Erreur de connexion:', error.message);
    }
    
    // Test 3: Test avec curl
    console.log('\n3. Test avec curl...');
    const { exec } = require('child_process');
    
    exec(`curl -X POST "${baseUrl}/api/auth/signin/credentials" -H "Content-Type: application/x-www-form-urlencoded" -d "email=admin@entreprise-demo.com&password=admin123&callbackUrl=/dashboard"`, (error, stdout, stderr) => {
      if (error) {
        console.log('   Erreur curl:', error.message);
      } else {
        console.log('   Réponse curl:', stdout.substring(0, 200) + '...');
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testNextAuth();

