import React from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-provider';

export function AdminLoginTest() {
  const { loginWithCredentials } = useAuth();

  const handleTestLogin = async () => {
    try {
      await loginWithCredentials('admin', '12345');
      console.log('✅ Test login successful');
    } catch (error) {
      console.error('❌ Test login failed:', error);
    }
  };

  return (
    <div className="p-4">
      <Button onClick={handleTestLogin}>
        Test Admin Login
      </Button>
    </div>
  );
}

export default AdminLoginTest;
