import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Rocket, SignIn, Eye, EyeSlash } from '@phosphor-icons/react';
import { useAuth, LoginCredentials } from '@/lib/auth';

interface LoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoginSuccess?: () => void;
}

export function LoginModal({ open, onOpenChange, onLoginSuccess }: LoginModalProps) {
  const { login, loginWithESI, isLoading } = useAuth();
  const [credentials, setCredentials] = useState<LoginCredentials>({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCredentialLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    
    console.log('🔑 Modal: Login attempt for:', credentials.username);

    if (!credentials.username?.trim() || !credentials.password?.trim()) {
      setError('Please enter both username and password');
      return;
    }

    try {
      console.log('🚀 Modal: Calling login function...');
      await login(credentials, () => {
        console.log('📍 Modal: Login success callback - closing modal');
        onOpenChange(false);
        if (onLoginSuccess) {
          onLoginSuccess();
        }
      });
      console.log('✅ Modal: Login process completed');
    } catch (err) {
      console.error('❌ Modal: Login error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
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
      onOpenChange(false); // Close modal before redirect
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket size={24} className="text-accent" />
            Sign In to LMeve
          </DialogTitle>
          <DialogDescription>
            Login with your EVE Online character or use credentials
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}