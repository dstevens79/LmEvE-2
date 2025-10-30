# LMeve Database Server - Quick Start Guide

## One-Command Setup

On a **fresh Ubuntu/Debian server** with internet access:

```bash
wget https://raw.githubusercontent.com/dstevens79/LmEvE-2/main/scripts/setup-lmeve-db.sh && chmod +x setup-lmeve-db.sh && sudo ./setup-lmeve-db.sh
```

That's it! The script handles everything.

## What You'll Be Asked

1. **System Update?** - Recommended: Yes
2. **Firewall Setup?** - Recommended: Option 2 (Configure UFW)
3. **Database Type?** - Your choice: MySQL (1) or MariaDB (2)
4. **Install Webmin?** - Optional: Yes for web management
5. **Database Host** - Usually: localhost
6. **Database Port** - Usually: 3306
7. **MySQL Root Password** - Set a strong password
8. **LMeve Username** - Usually: lmeve
9. **LMeve Password** - Set a strong password
10. **Download SDE?** - Recommended: Yes

## After Installation

You'll get connection details:
- **Host**: localhost:3306 (or your custom)
- **Username**: lmeve (or your custom)
- **Password**: [what you set]
- **Databases**: lmeve, EveStaticData

Use these in your LMeve web application settings.

## Webmin Access

If you installed Webmin, access it at:
```
https://your-server-ip:10000
```
Login with your system root credentials.

## Troubleshooting

**Can't connect?**
- Verify MySQL is running: `sudo systemctl status mysql` (or `mariadb`)
- Check firewall: `sudo ufw status`

**Forgot to enable something?**
- Firewall: `sudo ufw allow 3306/tcp`
- Database service: `sudo systemctl start mysql` (or `mariadb`)

**Need to re-run?**
- Remove databases first: `sudo mysql -u root -p -e "DROP DATABASE lmeve; DROP DATABASE EveStaticData;"`
- Then run script again

## Manual SDE Import

If SDE import failed or was skipped:
```bash
wget https://www.fuzzwork.co.uk/dump/latest/eve.db.bz2
bunzip2 eve.db.bz2
mysql -u lmeve -p EveStaticData < eve.db
```

## Next Steps

1. ✅ Database server is ready
2. → Install LMeve web application on another server (or same)
3. → Configure LMeve to connect to this database
4. → Register corporations and start using LMeve!

## Support

Full documentation: [README.md](README.md)

Issues? Check: https://github.com/dstevens79/LmEvE-2/issues
