// Simple test script to verify admin login logic
console.log('Testing admin login functionality...');

// Simulate the admin login logic from auth.ts
function testAdminLogin(username, password, adminConfig = { username: 'admin', password: '12345' }) {
  console.log(`\nTesting login: username="${username}", password="${password}"`);
  
  // Trim whitespace from inputs (same as in auth.ts)
  const trimmedUsername = username?.trim() || '';
  const trimmedPassword = password?.trim() || '';
  
  console.log(`After trimming: username="${trimmedUsername}", password="${trimmedPassword}"`);
  
  // Check for admin login if configured
  if (adminConfig && trimmedUsername === adminConfig.username && trimmedPassword === adminConfig.password) {
    console.log('✅ Admin login successful (configured)');
    return {
      success: true,
      user: {
        characterId: 999999999,
        characterName: 'Local Administrator',
        corporationId: 1000000000,
        corporationName: 'LMeve Administration',
        isAdmin: true,
        isDirector: true,
        isCeo: true
      }
    };
  }

  // Default admin credentials (admin/12345)
  if (trimmedUsername === 'admin' && trimmedPassword === '12345') {
    console.log('✅ Admin login successful (default)');
    return {
      success: true,
      user: {
        characterId: 999999999,
        characterName: 'Local Administrator',
        corporationId: 1000000000,
        corporationName: 'LMeve Administration',
        isAdmin: true,
        isDirector: true,
        isCeo: true
      }
    };
  }

  console.log('❌ Login failed');
  return { success: false, error: 'Invalid credentials' };
}

// Test cases
console.log('='.repeat(50));
console.log('TESTING ADMIN LOGIN FUNCTIONALITY');
console.log('='.repeat(50));

// Test 1: Valid admin credentials
testAdminLogin('admin', '12345');

// Test 2: Valid admin credentials with whitespace
testAdminLogin('  admin  ', '  12345  ');

// Test 3: Wrong password
testAdminLogin('admin', 'wrong');

// Test 4: Wrong username
testAdminLogin('wrong', '12345');

// Test 5: Empty credentials
testAdminLogin('', '');

// Test 6: Custom admin config
const customConfig = { username: 'customadmin', password: 'custompass' };
testAdminLogin('customadmin', 'custompass', customConfig);

console.log('\n' + '='.repeat(50));
console.log('TESTING COMPLETE');
console.log('='.repeat(50));