# LmEvE 2 - Installation

Two separate machines are supported. Run the right script **on the right host**.

## 1) App server (required) - where LmEvE runs

Run **on the app/web host** (Ubuntu/Debian, root required). This does NOT install MySQL - the database can live anywhere and is configured later in the app (Settings -> Database).

```bash
wget https://raw.githubusercontent.com/dstevens79/LmEvE-2/main/scripts/setup-lmeve-app.sh
chmod +x setup-lmeve-app.sh
sudo ./setup-lmeve-app.sh
```

What it does: apt update, installs Apache + PHP (with php-mysql client only, no server), Node.js 20, clones/builds/deploys the SPA, configures the Apache vhost and optional SSL/cron. No mysql-server/mariadb-server.

After: open http://<app-host>/ -> sign in as offline admin admin / 12345 -> Settings -> Database to point at any reachable MySQL/MariaDB (local, remote, or managed) -> Settings -> General / ESI to set your CCP application callback.

## 2) Database server (optional) - only if you need a new DB

If you already have a reachable MySQL/MariaDB, skip this. Otherwise run **on the database host** to provision one from scratch:

```bash
wget https://raw.githubusercontent.com/dstevens79/LmEvE-2/main/scripts/setup-lmeve-db.sh
chmod +x setup-lmeve-db.sh
sudo ./setup-lmeve-db.sh
```

What it does: installs MySQL or MariaDB (your choice), creates lmeve2 + EveStaticData, creates the lmeve user (%% + localhost), optionally imports the SDE and Webmin. Note the connection summary, then use those values in the app's Settings -> Database on the app host.

## Manual install (no scripts)

Equivalent manual steps mirror the scripts - do NOT install mysql-server on the app host unless the DB really lives there.

App host: sudo apt install -y apache2 php libapache2-mod-php php-mysql php-curl php-xml php-zip php-gd php-mbstring php-cli unzip curl wget git ufw -> Node 20 via NodeSource -> clone/build -> Apache vhost.

DB host (if new): on that host only -> sudo apt install -y mysql-server (or mariadb-server) -> sudo mysql_secure_installation -> CREATE DATABASE lmeve2 / EveStaticData + CREATE USER 'lmeve'@'%%' + GRANT -> enable remote bind-address = 0.0.0.0 if needed.