Local server settings

This folder holds the local server configuration file used by API endpoints:

- Path: server/storage/settings.json (created automatically when you save settings through /api/settings)
- Purpose: Persist site configuration on the server, even if browsers clear storage.
- Security: API responses mask secret fields; secrets remain only on the server file system.

Shapes supported
- Root JSON object may be a direct settings object or wrapped as { "settings": { ... } }.
- Common sections:
  - database: { host, port, username, password, database }
  - esi: { clientId, clientSecret, callbackUrl, userAgent }
  - any additional site-specific sections you need

Secret handling
- The fields password, clientSecret, sudoPassword, smtpPassword are treated as secrets.
- When reading on the server, if a secret value is '***', it is considered empty/unknown.
- When returning settings via GET /api/settings, secrets are masked to '***'.
- When saving via POST /api/settings, submitting '***' for a secret field preserves the existing stored value.

Bootstrap
- You can pre-create server/storage/settings.json with your baseline configuration, or POST to /api/settings to generate it.
- Example minimal JSON:

{
  "database": {
    "host": "localhost",
    "port": 3306,
    "username": "lmeve",
    "password": "your-db-password",
    "database": "lmeve2"
  },
  "esi": {
    "clientId": "your-ccp-client-id",
    "clientSecret": "your-ccp-client-secret",
    "callbackUrl": "https://your-site.example.com/",
    "userAgent": "LMeve-2"
  }
}

Notes
- Do not commit real credentials to source control. Keep server/storage/settings.json out of version control.
- Ensure the web server user has read/write access to this directory.
- Storage location resolution (server-side):
  1) Preferred: this repo path, server/storage
  2) If set: environment variable LMEVE_STORAGE_DIR
  3) Fallback: system temp directory, e.g. /tmp/lmeve2-storage
  The API endpoints will use the first directory that exists and is writable.

Permissions quick-fix (Linux/Apache example)
```
sudo mkdir -p server/storage
sudo chown -R www-data:www-data server/storage
sudo chmod -R 775 server/storage
```

Alternative: point storage at a custom location
```
export LMEVE_STORAGE_DIR=/var/lib/lmeve2
sudo mkdir -p "$LMEVE_STORAGE_DIR"
sudo chown -R www-data:www-data "$LMEVE_STORAGE_DIR"
sudo chmod -R 775 "$LMEVE_STORAGE_DIR"
```
