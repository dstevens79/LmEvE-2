// Test script to debug authentication
console.log('Testing auth flow...');

// Check if we're in the right environment
if (typeof window !== 'undefined' && window.spark) {
  console.log('Spark API available');
  
  // Test KV operations
  async function testKV() {
    try {
      console.log('Testing KV store...');
      
      // Set a test value
      await window.spark.kv.set('test-auth', { username: 'admin', isAdmin: true });
      
      // Get it back
      const result = await window.spark.kv.get('test-auth');
      console.log('KV test result:', result);
      
      // Test auth user specifically
      console.log('Checking current auth-user...');
      const authUser = await window.spark.kv.get('auth-user');
      console.log('Current auth-user:', authUser);
      
      // List all keys
      const keys = await window.spark.kv.keys();
      console.log('All KV keys:', keys);
      
    } catch (error) {
      console.error('KV test failed:', error);
    }
  }
  
  testKV();
} else {
  console.log('Spark API not available - this script should be run in the browser console');
}