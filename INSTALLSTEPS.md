2. Configure Application and App Secret at Eve Developer site

3. System Pre Prep 
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git ufw build-essential

  --sudo apt update && sudo apt upgrade -y
   
  --sudo apt install -y curl wget git ufw build-essential

Enable basic firewall access: (or disable it)
  sudo ufw allow OpenSSH
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw enable

    sudo ufw allow OpenSSH
    
    sudo ufw allow 80/tcp
    
    sudo ufw allow 443/tcp
  
    sudo ufw enable

Install Apache, MySQL, and PHP
  sudo apt install -y apache2 mysql-server php libapache2-mod-php php-mysql php-curl php-xml php-zip php-gd php-mbstring php-json php-cli unzip
  
    sudo apt install -y apache2 mysql-server php libapache2-mod-php php-mysql php-curl php-xml php-zip php-gd php-mbstring php-json php-cli unzip

Enable Apache rewrite & restart:
  sudo a2enmod rewrite
  sudo systemctl restart apache2
    
    sudo a2enmod rewrite
    sudo systemctl restart apache2

Check that Apache works:
  sudo systemctl status apache2
    
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
    
    cd /var/www/
    sudo git clone https://github.com/dstevens79/eve-online-api-moder.git 
    cd eve-online-api-moder
    sudo npm install
    sudo npm run build


This creates:
  /var/www/eve-online-api-moder/dist/
      
      /var/www/eve-online-api-moder/dist/

You should now have /var/www/eve-online-api-moder/dist/index.html with hashed /assets files.

Now : Configure Apache Virtual Host
Create a new site file:
  sudo nano /etc/apache2/sites-available/lmeve.conf

Paste or type in:

  <VirtualHost *:80>
    ServerName localhost
    DocumentRoot /var/www/eve-online-api-moder/dist
    sudo nano /etc/apache2/sites-available/lmeve.conf

    <Directory /var/www/eve-online-api-moder/dist>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
Paste or type in:

    ErrorLog ${APACHE_LOG_DIR}/lmeve_error.log
    CustomLog ${APACHE_LOG_DIR}/lmeve_access.log combined
  </VirtualHost>
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
    sudo a2ensite lmeve.conf
    sudo systemctl reload apache2


Visit:

http://<your-server-ip>/
  
    http://<your-server-ip>/


If blank → check browser console for missing files; they should load from /assets/....

Finally : Set Permissions
  sudo chown -R www-data:www-data /var/www/eve-online-api-moder
  sudo chmod -R 755 /var/www/eve-online-api-moder
  
    sudo chown -R www-data:www-data /var/www/eve-online-api-moder
    sudo chmod -R 755 /var/www/eve-online-api-moder

Ensure Apache allows .htaccess overrides:
  sudo nano /etc/apache2/apache2.conf
    
    sudo nano /etc/apache2/apache2.conf
Find and modify:
  <Directory /var/www/>
    AllowOverride All
  </Directory>
    
    <Directory /var/www/>
      AllowOverride All
    </Directory>

Then reload:
  sudo systemctl reload apache2
  
    sudo systemctl reload apache2

Test
Open your browser:
