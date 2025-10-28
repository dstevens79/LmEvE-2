import React from 'react';
import { Shield, Warning } from '@phosphor-icons/react';

interface EVELoginButtonProps {
  onClick: () => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  className?: string;
  showCorporationCount?: number;
  showValidationStatus?: 'configured' | 'no-corps' | 'not-configured';
}

export function EVELoginButton({ 
  onClick, 
  disabled = false, 
  size = 'medium', 
  className = '',
  showCorporationCount,
  showValidationStatus
}: EVELoginButtonProps) {
  const sizeClasses = {
    small: 'h-[30px]',
    medium: 'h-[40px]', 
    large: 'h-[50px]'
  };

  const iconSizes = {
    small: 12,
    medium: 16,
    large: 20
  };

  const getTooltipText = () => {
    if (showValidationStatus === 'not-configured') {
      return 'ESI authentication is not configured. Contact your administrator.';
    } else if (showValidationStatus === 'no-corps') {
      return 'No corporations registered. Directors/CEOs can register their corporation automatically.';
    } else if (showValidationStatus === 'configured' && showCorporationCount) {
      return `${showCorporationCount} corporation${showCorporationCount > 1 ? 's' : ''} registered`;
    }
    return 'Authenticate with EVE Online SSO';
  };

  const getStatusIndicator = () => {
    if (showValidationStatus === 'configured') {
      return (
        <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-1">
          <Shield size={12} className="text-white" />
        </div>
      );
    } else if (showValidationStatus === 'no-corps') {
      return (
        <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full p-1">
          <Warning size={12} className="text-white" />
        </div>
      );
    } else if (showValidationStatus === 'not-configured') {
      return (
        <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-1">
          <Warning size={12} className="text-white" />
        </div>
      );
    }
    return null;
  };

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        disabled={disabled}
        className={`relative transition-all duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        title={getTooltipText()}
      >
        <img 
          src="https://web.ccpgamescdn.com/eveonlineassets/developers/eve-sso-login-black-large.png"
          alt="Sign in with EVE Online"
          className={`${sizeClasses[size]} w-auto object-contain`}
        />
        
        {getStatusIndicator()}
        
        {showCorporationCount !== undefined && showCorporationCount > 0 && (
          <div className="absolute -bottom-1 -right-1 bg-accent rounded-full px-2 py-0.5 text-xs font-bold text-accent-foreground border-2 border-background">
            {showCorporationCount}
          </div>
        )}
      </button>
      
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-50 shadow-lg">
        {getTooltipText()}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black"></div>
      </div>
    </div>
  );
}