# ✨ Welcome to Your Spark Template!
You've just launched your brand-new Spark Template Codespace — everything’s fired up and ready for you to explore, build, and create with Spark!

This template is your blank canvas. It comes with a minimal setup to help you get started quickly with Spark development.

🚀 What's Inside?
- A clean, minimal Spark environment
- Pre-configured for local development
- Ready to scale with your ideas
  
🧠 What Can You Do?

Right now, this is just a starting point — the perfect place to begin building and testing your Spark applications.

<<<<<<< Updated upstream
### Authentication
- EVE Online SSO (OAuth 2.0) for character authentication
- Local username/password for local users
- Role-based access control 
- Multi-corporation support
=======


- Simply delete your Spark.
- Everything will be cleaned up — no traces left behind.

📄 License For Spark Template Resources 

<<<<<<< Updated upstream
## Tech Stack 

React 19 • TypeScript • Tailwind CSS • shadcn/ui • Framer Motion • Recharts • GitHub Spark KV

## Quick Start 
NOTE : If your using two machines or vm setup follow the ssh setup, if its all on one machine dont worry about it
either way you wont mess it up if its all on one machine if you do every step

1. Tested on dual ubuntu 20.04.6 LTS Virtual Machines from fresh OS installs (one for db one for lmeve-2)
2. Configure Application and App Secret at Eve Developer site

3. System Pre Prep 

  --sudo apt update && sudo apt upgrade -y
   
  --sudo apt install -y curl wget git ufw build-essential

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

IF THE TARGET DATABASE COMPUTER IS NOT A LOCAL LMEVE INSTANCE
{
  Configure SSH on both machines:
  To install SSH, run:
    
    sudo apt install -y openssh-server
  
  Then enable and start it:
    
    sudo systemctl enable ssh
    sudo systemctl start ssh
  
  Check that it’s running:
    
    sudo systemctl status ssh
  Firewall access (if using UFW and not disabled):
    
    sudo ufw allow OpenSSH
    sudo ufw reload
}
Then....
Run the secure MY_SQL setup on the TARGET DATABASE MACHINE:
{
    
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
}

Now all the rest is normal and done on the LMEVE machine or instance : 

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
=======
The Spark Template files and resources from GitHub are licensed under the terms of the MIT license, Copyright GitHub, Inc.
>>>>>>> Stashed changes
