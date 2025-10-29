# Fixed Issues Log

## Tab Navigation Freeze Issue
**Problem**: Clicking on Members tab or other tabs caused the app to freeze
**Root Cause**: 
1. LMeveDataContext was importing wrong auth hook (`useAuth` instead of `useCorporationAuth`)
2. Members tab had infinite loop in useEffect dependencies
3. Auth checks in tab components were causing rendering issues

**Solution**:
1. Fixed LMeveDataContext to use `useCorporationAuth` instead of `useAuth`
2. Simplified Members tab useEffect to only depend on `user` to prevent infinite loops
3. Temporarily disabled auth requirement checks in tab components (line 93 in Members.tsx: `&& false`)
4. Added debug tab to Settings for troubleshooting authentication issues

## Debug Features Added
- New Debug tab in Settings with comprehensive auth state information
- Shows current user details, corporation registry, admin config, and ESI status
- Includes existing AdminLoginTest and SimpleLoginTest components
- Real-time debug information for troubleshooting authentication flow

## Authentication State
- App now always shows main interface (no blocking login page)
- Login handled via modal in header
- All tabs accessible regardless of auth state (for debugging)
- Debug overlay available in development mode showing current auth state