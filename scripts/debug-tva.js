// Debug script to check TVA settings issue
console.log('🔍 Debugging TVA Settings Issue...');

// Check if we can access the settings page
console.log('1. Testing if settings page loads...');
console.log('   Go to: http://localhost:3000/settings');
console.log('   Check if you are logged in');
console.log('   Check if TVA tab is visible');

console.log('\n2. Testing API endpoints...');
console.log('   GET /api/settings - Should return settings with TVA section');
console.log('   PATCH /api/settings/tva - Should update TVA settings');

console.log('\n3. Common issues:');
console.log('   - User not logged in (401 Unauthorized)');
console.log('   - Missing X-Tenant-Id header');
console.log('   - TVA section not initialized in CompanySettings');
console.log('   - MongoDB connection issues');

console.log('\n4. To fix:');
console.log('   - Make sure you are logged in');
console.log('   - Check browser console for errors');
console.log('   - Check server logs for errors');
console.log('   - Verify tenantId is set correctly');

console.log('\n5. Test steps:');
console.log('   1. Open browser to http://localhost:3000/settings');
console.log('   2. Click on TVA tab');
console.log('   3. Try to change a setting');
console.log('   4. Check browser console for errors');
console.log('   5. Check server terminal for logs');
