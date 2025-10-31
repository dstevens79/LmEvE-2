// Simple, working authentication based on LMeve patterns
import { useKV } from '@/lib/kv';
import React from 'react';

export interface SimpleUser {
  id: number;
  name: string;
  corp: string;
  isAdmin: boolean;
  loginTime: number;
}

// Simple authentication service
class SimpleAuthService {
  validateCredentials(username: string, password: string): SimpleUser | null {
    console.log('🔐 SimpleAuth: Validating credentials', { username, password });
    
    // Check admin login
    if (username === 'admin' && password === '12345') {
      console.log('✅ SimpleAuth: Admin login successful');
      return {
        id: 999999999,
        name: 'Local Administrator',
        corp: 'LMeve Administration',
        isAdmin: true,
        loginTime: Date.now()
      };
    }
    
    console.log('❌ SimpleAuth: Invalid credentials');
    return null;
  }
}

const authService = new SimpleAuthService();

export function useSimpleAuth() {
  const [currentUser, setCurrentUser] = useKV<SimpleUser | null>('simple-auth-user', null);
  const [isLoading, setIsLoading] = React.useState(false);
  
  const login = async (username: string, password: string): Promise<boolean> => {
    console.log('🚀 SimpleAuth Hook: Login attempt for', username);
    setIsLoading(true);
    
    try {
      const user = authService.validateCredentials(username, password);
      
      if (user) {
        console.log('✅ SimpleAuth Hook: Setting user', user.name);
        setCurrentUser(user);
        return true;
      } else {
        console.log('❌ SimpleAuth Hook: Login failed');
        return false;
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const logout = () => {
    console.log('🚪 SimpleAuth Hook: Logging out');
    setCurrentUser(null);
  };
  
  const isAuthenticated = Boolean(currentUser);
  
  console.log('🔄 SimpleAuth Hook: State', { 
    hasUser: !!currentUser, 
    userName: currentUser?.name,
    isAuthenticated 
  });
  
  return {
    user: currentUser,
    isAuthenticated,
    isLoading,
    login,
    logout
  };
}