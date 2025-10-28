import React from 'react';
import { LoginPrompt } from '@/components/LoginPrompt';
import { useAuth } from '@/lib/auth-provider';

interface TabComponentProps {
  onLoginClick?: () => void;
}

export function withAuthCheck<P extends TabComponentProps>(
  Component: React.ComponentType<P>,
  loginTitle?: string,
  loginDescription?: string
) {
  return function AuthenticatedComponent(props: P) {
    const { user } = useAuth();
    
    // Show login prompt if not authenticated
    if (!user && props.onLoginClick) {
      return (
        <LoginPrompt 
          onLoginClick={props.onLoginClick}
          title={loginTitle || "Authentication Required"}
          description={loginDescription || "Please sign in to access this feature"}
        />
      );
    }

    // Render the actual component if authenticated
    return <Component {...props} />;
  };
}