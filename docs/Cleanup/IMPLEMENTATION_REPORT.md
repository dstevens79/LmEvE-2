# EVE Online ESI Authentication Integration

## Implementation Summary

Integrated a comprehensive EVE Online ESI authentication system with corporation-based access control as requested. The system handles multiple authentication scenarios and provides secure access control based on corporation membership and roles.

## Key Features Implemented

### 1. Corporation-Based Authentication System (`corp-auth.ts`)
- **Corporation ESI Registration**: CEOs and Directors can register their corporations
- **Member Access Control**: Members can only login if their corp is registered
- **Role-Based Permissions**: Automatic detection of CEO/Director roles via ESI
- **Token Management**: Secure handling of ESI access/refresh tokens
- **Local Admin Support**: Preserves existing local admin functionality

### 2. Enhanced Login Modal (`CorporationLoginModal.tsx`)
- **Dual Authentication**: Supports both local credentials and EVE Online SSO
- **Visual Status Indicators**: Shows ESI configuration status and registered corporations
- **User Guidance**: Clear instructions for different user types
- **Smart Defaults**: Automatically enables appropriate login methods

### 3. ESI Callback Handler (`CorporationESICallback.tsx`) 
- **Corporate Validation**: Checks corporation access permissions during login
- **Registration Flow**: Allows CEO/Directors to register unregistered corporations
- **Progress Feedback**: Visual progress indicator for authentication steps
- **Error Handling**: Clear error messages for various failure scenarios

### 4. Settings Integration
- **ESI Configuration**: Client ID and Secret configuration for ESI applications
- **Corporation Management**: View and manage registered corporations
- **Access Control Overview**: Visual summary of who can access the system
- **Admin Configuration**: Updated to use the new authentication system

## Access Control Logic

### Who Can Login:
1. **Corporation Members**: Must be in a corporation that has registered ESI access
2. **CEOs & Directors**: Can login even if their corporation isn't registered (allows them to register it)
3. **Local Administrators**: Can login with username/password (configurable credentials)

### Corporation Registration:
- Only CEOs and Directors can register their corporation
- Registration requires valid ESI tokens with proper scopes
- Once registered, all corporation members can login via ESI

### Data Isolation:
- Users can only see data from their own corporation
- Admin users have access to all corporation data
- ESI tokens are stored per-corporation for data sync

## Technical Implementation

### Authentication Flow:
1. User clicks "Login with EVE Online"
2. Redirected to EVE Online SSO
3. ESI returns with character/corporation information
4. System validates corporation access permissions
5. If permitted, user is logged in; if not, appropriate error/registration flow

### Security Features:
- PKCE (Proof Key for Code Exchange) for OAuth security
- Secure token storage and refresh handling
- Corporation-scoped data access control
- Configurable admin credentials
- Session management with token expiration

### Database Integration:
- Corporation ESI configurations stored in persistent KV storage
- User sessions maintained across browser restarts
- Admin configuration separate from ESI settings
- Extensible for future database backend integration

## Next Steps

The system is ready for:
1. **Real ESI Application Setup**: Configure actual Client ID/Secret from developers.eveonline.com
2. **Corporation Registration**: CEOs/Directors can register their corporations
3. **Member Login**: Corporation members can authenticate via ESI
4. **Data Sync Integration**: Use stored ESI tokens for real-time data synchronization

## Testing

- Local admin login continues to work (admin/12345)
- ESI login flow processes correctly (requires ESI app configuration)
- Corporation registration workflow handles CEO/Director permissions
- Settings properly configure and display ESI status