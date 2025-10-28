import React, { useEffect, useState } from 'react';
import { Rocket, Warning, CheckCircle, CircleNotch, Info } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/lib/auth-provider';

interface ESICallbackProps {
  onLoginSuccess: () => void;
  onLoginError: () => void;
}

export function ESICallback({ onLoginSuccess, onLoginError }: ESICallbackProps) {
  const { handleESICallback } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);
  const [characterName, setCharacterName] = useState<string | null>(null);
  const [scopeWarnings, setScopeWarnings] = useState<string[]>([]);

  useEffect(() => {
    const processCallback = async () => {
      try {
        console.log('🔄 Processing ESI callback');
        setStatus('processing');
        
        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');
        
        // Handle OAuth error
        if (error) {
          const errorDescription = urlParams.get('error_description') || 'Authentication was denied or cancelled';
          throw new Error(errorDescription);
        }
        
        // Validate required parameters
        if (!code || !state) {
          throw new Error('Missing required authentication parameters');
        }
        
        console.log('🔄 Processing ESI authentication with code and state');
        
        // Process the callback
        const user = await handleESICallback(code, state);
        
        setCharacterName(user.characterName || 'Unknown Character');
        
        // Check for scope warnings
        const warnings: string[] = [];
        if (user.corporationScopes && user.corporationScopes.length === 0 && 
            (user.role === 'corp_director' || user.role === 'corp_admin')) {
          warnings.push('Limited corporation access - some features may be unavailable');
        }
        
        if (warnings.length > 0) {
          setScopeWarnings(warnings);
        }
        
        setStatus('success');
        
        console.log('✅ ESI authentication successful', {
          character: user.characterName,
          role: user.role,
          characterScopes: user.characterScopes?.length || 0,
          corporationScopes: user.corporationScopes?.length || 0
        });
        
        // Delay to show success message
        setTimeout(() => {
          onLoginSuccess();
        }, 2000);
        
      } catch (error) {
        console.error('❌ ESI callback processing failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
        setError(errorMessage);
        setStatus('error');
        
        // Delay to show error message
        setTimeout(() => {
          onLoginError();
        }, 3000);
      }
    };
    
    processCallback();
  }, [handleESICallback, onLoginSuccess, onLoginError]);

  const handleRetry = () => {
    onLoginError();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {status === 'processing' && (
              <div className="bg-accent/20 p-4 rounded-full">
                <CircleNotch size={32} className="text-accent animate-spin" />
              </div>
            )}
            {status === 'success' && (
              <div className="bg-green-500/20 p-4 rounded-full">
                <CheckCircle size={32} className="text-green-500" />
              </div>
            )}
            {status === 'error' && (
              <div className="bg-red-500/20 p-4 rounded-full">
                <Warning size={32} className="text-red-500" />
              </div>
            )}
          </div>
          
          <CardTitle className="text-xl">
            {status === 'processing' && 'Processing Authentication'}
            {status === 'success' && 'Authentication Successful'}
            {status === 'error' && 'Authentication Failed'}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {status === 'processing' && (
            <div className="text-center text-muted-foreground">
              <p className="mb-2">Authenticating with EVE Online...</p>
              <p className="text-sm">Validating scopes and permissions...</p>
            </div>
          )}
          
          {status === 'success' && (
            <div className="text-center space-y-2">
              <p className="text-green-500 font-medium">
                Welcome, {characterName}!
              </p>
              <p className="text-sm text-muted-foreground">
                Your EVE Online authentication was successful. 
                You will be redirected to the dashboard shortly.
              </p>
              
              {scopeWarnings.length > 0 && (
                <Alert className="mt-4">
                  <Info size={16} />
                  <AlertDescription>
                    {scopeWarnings.map((warning, idx) => (
                      <div key={idx}>{warning}</div>
                    ))}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          
          {status === 'error' && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <Warning size={16} />
                <AlertDescription>
                  {error}
                </AlertDescription>
              </Alert>
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  {error?.includes('scope') ? (
                    <>
                      This error is related to ESI permissions. Make sure you granted all requested permissions during login.
                      <br />
                      <strong>Tip:</strong> Corporation scopes require Director or CEO roles in-game.
                    </>
                  ) : (
                    'Please try signing in again or contact your administrator if the problem persists.'
                  )}
                </p>
                <Button onClick={handleRetry} variant="outline" className="w-full">
                  <Rocket size={16} className="mr-2" />
                  Return to Login
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}