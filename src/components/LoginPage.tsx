import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Rocket, SignIn, Eye, EyeSlash } from '@phosphor-icons/react';
import { useAuth, LoginCredentials } from '@/lib/auth';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const { login, loginWithESI, isLoading, user, isAuthenticated } = useAuth();
  const [credentials, setCredentials] = useState<LoginCredentials>({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  // Debug effect to track auth state changes
  React.useEffect(() => {
    console.log('🔍 LoginPage auth state changed:', {
      hasUser: !!user,
      characterName: user?.characterName,
      isAuthenticated,
      shouldRedirect: isAuthenticated && !!user,
      timestamp: Date.now()
    });
    
    // If user exists, this component should not be shown anymore
    if (user) {
      console.log('✅ User exists in LoginPage - App should handle redirect');
    }
  }, [user, isAuthenticated]);

  const handleCredentialLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setDebugInfo('Starting login process...');
    
    console.log('🔑 Login attempt for:', credentials.username);

    if (!credentials.username?.trim() || !credentials.password?.trim()) {
      setError('Please enter both username and password');
      setDebugInfo('Error: Missing credentials');
      return;
    }

    try {
      setDebugInfo('Calling auth service...');
      
      // Pass navigation callback for direct page change
      await login(credentials, () => {
        console.log('📍 LOGIN SUCCESS CALLBACK EXECUTING - immediate navigation');
        setDebugInfo('✅ Login successful - executing immediate navigation');
        
        // Call the immediate navigation function from App
        if (onLoginSuccess) {
          console.log('📍 Calling onLoginSuccess navigation function');
          onLoginSuccess();
        } else {
          console.log('❌ No onLoginSuccess callback provided');
        }
      });
      
      setDebugInfo('✅ Login successful - navigation should be complete');
      console.log('✅ Login process completed');
      
    } catch (err) {
      console.error('❌ Login error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      setDebugInfo(`❌ Login failed: ${errorMessage}`);
    }
  };

  const handleESILogin = async () => {
    setError(null);
    console.log('🚀 Starting ESI authentication...');
    
    try {
      // Mark that we're attempting ESI login
      sessionStorage.setItem('esi-login-attempt', 'true');
      
      const authUrl = await loginWithESI();
      console.log('🔗 Redirecting to EVE SSO:', authUrl);
      window.location.href = authUrl;
    } catch (err) {
      console.error('❌ ESI login error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start ESI authentication');
      // Clean up attempt marker on error
      sessionStorage.removeItem('esi-login-attempt');
    }
  };

  const handleInputChange = (field: keyof LoginCredentials) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCredentials(prev => ({ ...prev, [field]: value }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCredentialLogin();
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-background to-primary/5" />
      
      <div className="w-full max-w-md relative">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Rocket size={32} className="text-accent" />
            <h1 className="text-3xl font-bold text-foreground">LMeve</h1>
          </div>
          <p className="text-muted-foreground">
            EVE Online Corporation Management
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your corporation's industry, assets, and operations
          </p>
        </div>

        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-center">Sign In</CardTitle>
            <CardDescription className="text-center">
              Login with your EVE Online character or use credentials
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* ESI Login Button */}
            <Button
              onClick={handleESILogin}
              disabled={isLoading}
              className="w-full bg-accent hover:bg-accent/90 active:bg-accent/80 text-accent-foreground transition-all duration-200 hover:shadow-lg hover:shadow-accent/20 active:scale-[0.98]"
              size="lg"
            >
              <SignIn size={18} className="mr-2" />
              Login with EVE Online
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            {/* Traditional Login Form */}
            <form onSubmit={handleCredentialLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={credentials.username}
                  onChange={handleInputChange('username')}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  className="bg-input border-border"
                  autoComplete="username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={credentials.password}
                    onChange={handleInputChange('password')}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    className="bg-input border-border pr-10"
                    autoComplete="current-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeSlash size={16} className="text-muted-foreground" />
                    ) : (
                      <Eye size={16} className="text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary hover:bg-primary/90 active:bg-primary/80 text-primary-foreground border-primary/20 transition-all duration-200 hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                variant="default"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            {/* Development Info */}
            <div className="pt-4 border-t border-border">
              {/* Debug panel - shows current auth state */}
              <div className="mb-4 p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground space-y-1">
                  <div><strong>Auth State:</strong> {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
                  <div><strong>User:</strong> {user?.characterName || 'None'}</div>
                  <div><strong>Should Redirect:</strong> {(isAuthenticated && !!user) ? 'YES' : 'NO'}</div>
                </div>
              </div>
              
              {debugInfo && (
                <div className="mb-4 p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    <strong>Debug:</strong> {debugInfo}
                  </p>
                </div>
              )}
              <p className="text-xs text-muted-foreground text-center mb-2">
                <strong>ESI Login:</strong> Requires corporation ESI data configuration. 
                Users must belong to a corporation with registered ESI access.
              </p>
              <p className="text-xs text-muted-foreground text-center mb-2">
                <strong>Demo Mode:</strong> For testing use credentials below.
              </p>
              <p className="text-xs text-muted-foreground text-center">
                Username: <code className="bg-muted px-1 rounded">admin</code>, 
                Password: <code className="bg-muted px-1 rounded">12345</code>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-muted-foreground">
          <p>LMeve is not affiliated with CCP Games or EVE Online</p>
          <p className="mt-1">EVE Online and the EVE logo are trademarks of CCP hf.</p>
        </div>
      </div>
    </div>
  );
}