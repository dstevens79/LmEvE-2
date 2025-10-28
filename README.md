# LMeve - EVE Online Corporation Management

A database-first corporation management tool for EVE Online with ESI integration for authentication and personal character data.

## Features

### Core Functionality
- **Member Management** - Character tracking with portraits and role assignment
- **Assets** - 7-division hangar browser with category filtering and search
- **Manufacturing** - Active job tracking with blueprint management and cost analysis
- **Market** - Order monitoring with sales tracking and profit analysis
- **Wallet** - Multi-division support with transaction history and trend analysis
- **Buyback System** - Contract workflow with market price syncing
- **Planetary Interaction** - Colony tracking across corporation members
- **Corporation Projects** - Material requirement tracking and contribution monitoring

### Authentication
- EVE Online SSO (OAuth 2.0) for character authentication
- Local username/password for local users
- Role-based access control 
- Multi-corporation support

### Data Management
- Database-first architecture (MySQL/PostgreSQL)
- Background sync processes populate database from ESI
- Visual indicators showing data source and freshness
- Connection monitoring for database health
- Mock data for demo/testing (disabled once database configured)

### Interface
- Tabbed navigation with permission-based access
- Mobile and desktop view modes
- Dark space theme optimized for readability
- Real-time loading states and notifications

## Tech Stack

React 19 • TypeScript • Tailwind CSS • shadcn/ui • Framer Motion • Recharts • GitHub Spark KV

## Quick Start
1. Tested on ubuntu 20.04.6 LTS - get this one... 
2. Configure Application and App Secret at Eve Developer site

3. System Pre Prep
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git ufw build-essential

Enable basic firewall access: (or disable it)
  sudo ufw allow OpenSSH
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw enable

Install Apache, MySQL, and PHP
  sudo apt install -y apache2 mysql-server php libapache2-mod-php php-mysql php-curl php-xml php-zip php-gd php-mbstring php-json php-cli unzip

Enable Apache rewrite & restart:
  sudo a2enmod rewrite
  sudo systemctl restart apache2

Check that Apache works:
  sudo systemctl status apache2

→ Visit http://<your-server-ip>/ — you should see the Apache default page.

On the same or another computer or vm instance (both are natively supported in the setup) - Configure MySQL
Run the secure MY_SQL setup:
  sudo mysql_secure_installation
  Set root password
  Remove anonymous users
  Disallow remote root login
  Remove test DB
Then:
  sudo mysql -u root -p

Now your Inside MySQL:
  CREATE DATABASE lmeve CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
  CREATE USER 'lmeveuser'@'localhost' IDENTIFIED BY 'StrongPasswordHere';
  GRANT ALL PRIVILEGES ON lmeve.* TO 'lmeveuser'@'localhost';
  FLUSH PRIVILEGES;
  EXIT;

Install Node.js + npm (latest stable)
Ubuntu 20.04 has older npm — pull Node v20.x (includes npm 10+):
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
  node -v
  npm -v

Clone and Build LMeve-2 Frontend
  cd /var/www/
  sudo git clone https://github.com/dstevens79/eve-online-api-moder.git 
  cd eve-online-api-moder
  sudo npm install
  sudo npm run build


This creates:
  /var/www/eve-online-api-moder/dist/

You should now have /var/www/eve-online-api-moder/dist/index.html with hashed /assets files.

Now : Configure Apache Virtual Host
Create a new site file:
  sudo nano /etc/apache2/sites-available/lmeve.conf

Paste or type in:
  <VirtualHost *:80>
    ServerName localhost
    DocumentRoot /var/www/eve-online-api-moder/dist

    <Directory /var/www/eve-online-api-moder/dist>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog ${APACHE_LOG_DIR}/lmeve_error.log
    CustomLog ${APACHE_LOG_DIR}/lmeve_access.log combined
  </VirtualHost>

Enable and restart:

  sudo a2ensite lmeve.conf
  sudo systemctl reload apache2


Visit:

http://<your-server-ip>/


If blank → check browser console for missing files; they should load from /assets/....

Finally : Set Permissions
  sudo chown -R www-data:www-data /var/www/eve-online-api-moder
  sudo chmod -R 755 /var/www/eve-online-api-moder

Ensure Apache allows .htaccess overrides:
  sudo nano /etc/apache2/apache2.conf
Find and modify:
  <Directory /var/www/>
    AllowOverride All
  </Directory>

Then reload:
  sudo systemctl reload apache2

Test
  Open your browser:
  http://your-server-ip/


You should see the LMeve login or dashboard UI.

Now your in LmEvE - 2 !
Next :
1. Configure ESI secret and database connection with the automated tool. (Settings → Database) Fill in the required fields. 
   1a. IF you use a remote machine deployment - you will have to have direct access to approve the
   ssh connection as well as have ssh prepared on the remote machine ready to accept connections!!!
   Everything else should take care of itself for the setup process after this one time approval for the app to connect on the remote machine or VM.
2. Set up ESI for corporation authentication (Settings → ESI)
3. Register your corporation
4. Assign user roles and permissions
5. Background sync processes will populate data - but you can force the issue with a global poller run

## Data Flow

**Database-First Architecture:**
1. **Primary Source**: Database (populated by background sync)
2. **ESI Usage**: Personal character data on login, background sync processes only
3. **Mock Data**: Demo data when database never configured (auto-disabled after setup) -- if you want to run a demo site do not complete setup!!!
4. Content tabs read from database only - no direct ESI calls for most data.

## License

MIT License - Copyright GitHub, Inc.

---
YES, i actually suck at coding and this was breathed into life with [GitHub Spark](https://githubnext.com/projects/github-spark) - (at this point 3 months of spark credits to get it working)
