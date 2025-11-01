# ESI OAuth Callback Migration Guide

## What Changed

LMeve-2 now uses a **pure SPA OAuth flow** instead of routing callbacks through a PHP endpoint.

### Previous Flow (Deprecated)
1. User clicks "Authenticate with EVE"
2. Redirected to EVE SSO
3. After approval, EVE redirects to `http://yoursite/api/auth/esi/callback.php`
4. PHP script does 302 redirect to SPA root with code/state
5. **Problem:** sessionStorage lost during server-side redirect
6. SPA can't validate callback → auth fails

### New Flow (Current)
1. User clicks "Authenticate with EVE"
2. Redirected to EVE SSO
3. After approval, EVE redirects to `http://yoursite/`
4. SPA handles callback directly
5. sessionStorage preserved → auth succeeds

## What You Need to Do

### 1. Update Your EVE Developer Application

Visit https://developers.eveonline.com and edit your LMeve application:

**Old callback URL:**
```
http://24.128.239.249/api/auth/esi/callback.php
```

**New callback URL:**
```
http://24.128.239.249/
```

Or if using a domain:
```
https://yourdomain.com/
```

**Important:** The callback URL must match exactly how you access your app (including http vs https and port number).

### 2. Clear Old Settings (Optional)

The app will auto-migrate stored callback URLs, but you can manually clear if needed:

```javascript
// In browser console:
let settings = JSON.parse(localStorage.getItem('lmeve-settings-esi'));
if (settings && settings.callbackUrl.includes('callback.php')) {
  settings.callbackUrl = window.location.origin + '/';
  localStorage.setItem('lmeve-settings-esi', JSON.stringify(settings));
  console.log('✅ Migrated callback URL');
}
```

Or use the storage tools page:
- Visit: `http://yoursite/tools/storage-tools.html`
- Click "Set Callback to Origin"

### 3. Test the Flow

1. Log out if currently authenticated
2. Click "Authenticate with EVE" or "Register Corporation ESI"
3. Select character and approve scopes
4. You should be redirected back to your app successfully

**If you still see "sits and spins":**
- Verify your EVE dev app callback URL matches your site origin exactly
- Check browser console for "No stored authentication state" errors
- Ensure you're accessing the site from the same URL as the callback (no http→https redirects, no IP→domain changes)

## Technical Details

### Token Storage Changes

**Old behavior:**
- Tokens stored in localStorage (persisted across sessions)
- PHP session could also hold tokens

**New behavior:**
- Tokens stored in sessionStorage + in-memory state only
- Tokens cleared when browser tab/window closes
- Never persisted to localStorage or database

### Why This Is Better

1. **Security:** Tokens don't persist past the browser session
2. **Reliability:** sessionStorage preserved throughout OAuth flow
3. **Simplicity:** No server-side session handling needed
4. **Standards:** Follows modern SPA OAuth best practices

## Troubleshooting

### "No stored authentication state" Error

**Cause:** sessionStorage was cleared or you're on a different origin than when you started login.

**Solution:**
1. Make sure callback URL in EVE dev app matches site origin exactly
2. Don't navigate away during the OAuth flow
3. Clear browser cache/cookies and try again

### Callback URL Mismatch

**Symptoms:** EVE shows "redirect_uri mismatch" error

**Solution:** 
- Your EVE dev app callback must be `http://yoursite/` (with trailing slash)
- Must match the scheme (http vs https) and port you're using

### Still Using PHP Endpoint

**Check:** Look for this in browser console during login:
```
🔎 Using redirect_uri: http://yoursite/api/auth/esi/callback.php
```

**Fix:** Settings → Database → ESI section → clear the Callback URL field and save

## Migration Checklist

- [ ] Updated EVE developer app callback URL to site root (with trailing slash)
- [ ] Cleared old callback URL from app settings (or let auto-migration handle it)
- [ ] Tested character login flow
- [ ] Tested corporation ESI registration flow
- [ ] Verified tokens are session-only (check localStorage—should not contain tokens)

## Rollback (Not Recommended)

If you absolutely need to revert to the PHP flow:

1. Restore callback URL in EVE dev app to `/api/auth/esi/callback.php`
2. Manually set callbackUrl in Settings → Database → ESI section
3. Note: This will bring back the "sits and spins" issue on corp auth

**Better solution:** Fix any issues with the SPA flow instead of rolling back.
