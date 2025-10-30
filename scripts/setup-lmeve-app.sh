#!/bin/bash

#########################################################
# LMeve-2 Application Installer
# Automated setup for Ubuntu/Debian systems
#########################################################

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Header
echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════╗"
echo "║     LMeve-2 Application Setup & Installer        ║"
echo "╚════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check for root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root (use sudo)${NC}"
    exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo -e "${RED}Error: Cannot detect OS version${NC}"
    exit 1
fi

if [[ ! "$OS" =~ ^(ubuntu|debian)$ ]]; then
    echo -e "${YELLOW}Warning: This script is designed for Ubuntu/Debian${NC}"
    read -p "Continue anyway? (y/N): " confirm
    [[ ! "$confirm" =~ ^[Yy]$ ]] && exit 1
fi

echo -e "\n${GREEN}1. System Update${NC}"
echo "Updating package lists..."
apt-get update -qq

echo -e "\n${GREEN}2. Installing Node.js 20.x${NC}"
if ! command -v node &> /dev/null || [[ ! "$(node -v)" =~ ^v20 ]]; then
    echo "Installing Node.js 20.x from NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    echo -e "${GREEN}✓ Node.js $(node -v) installed${NC}"
else
    echo -e "${GREEN}✓ Node.js $(node -v) already installed${NC}"
fi

echo -e "\n${GREEN}3. Installing Apache Web Server${NC}"
if ! command -v apache2 &> /dev/null; then
    apt-get install -y apache2
    systemctl enable apache2
    systemctl start apache2
    echo -e "${GREEN}✓ Apache installed and started${NC}"
else
    echo -e "${GREEN}✓ Apache already installed${NC}"
fi

echo -e "\n${GREEN}4. Installing Git${NC}"
if ! command -v git &> /dev/null; then
    apt-get install -y git
    echo -e "${GREEN}✓ Git installed${NC}"
else
    echo -e "${GREEN}✓ Git already installed${NC}"
fi

# Get installation directory
echo -e "\n${BLUE}Installation Directory${NC}"
read -p "Install directory [/var/www/lmeve2]: " INSTALL_DIR
INSTALL_DIR=${INSTALL_DIR:-/var/www/lmeve2}

# Get domain/server name
echo -e "\n${BLUE}Server Configuration${NC}"
read -p "Server name/domain [lmeve2.local]: " SERVER_NAME
SERVER_NAME=${SERVER_NAME:-lmeve2.local}

read -p "Server admin email [admin@${SERVER_NAME}]: " ADMIN_EMAIL
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@${SERVER_NAME}}

echo -e "\n${GREEN}5. Cloning Repository${NC}"
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}Warning: Directory $INSTALL_DIR already exists${NC}"
    read -p "Remove and re-clone? (y/N): " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        rm -rf "$INSTALL_DIR"
    else
        echo -e "${YELLOW}Skipping clone, using existing directory${NC}"
    fi
fi

if [ ! -d "$INSTALL_DIR" ]; then
    git clone https://github.com/dstevens79/LmEvE-2.git "$INSTALL_DIR"
    echo -e "${GREEN}✓ Repository cloned${NC}"
fi

cd "$INSTALL_DIR"

echo -e "\n${GREEN}6. Installing Dependencies${NC}"
echo "Running npm install (this may take a few minutes)..."
npm install --silent
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo -e "\n${GREEN}7. Building Application${NC}"
npm run build
echo -e "${GREEN}✓ Build complete${NC}"

echo -e "\n${GREEN}8. Configuring Apache${NC}"

# Enable required modules
a2enmod rewrite
a2enmod headers
a2enmod ssl

# Create Apache config
VHOST_FILE="/etc/apache2/sites-available/${SERVER_NAME}.conf"

cat > "$VHOST_FILE" << EOF
<VirtualHost *:80>
    ServerName ${SERVER_NAME}
    ServerAdmin ${ADMIN_EMAIL}
    
    DocumentRoot ${INSTALL_DIR}/dist
    
    <Directory ${INSTALL_DIR}/dist>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        # React Router support
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>
    
    # Security headers
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "1; mode=block"
    
    ErrorLog \${APACHE_LOG_DIR}/${SERVER_NAME}-error.log
    CustomLog \${APACHE_LOG_DIR}/${SERVER_NAME}-access.log combined
</VirtualHost>
EOF

# Enable site
a2ensite "${SERVER_NAME}.conf"

# Disable default site if enabled
a2dissite 000-default.conf 2>/dev/null || true

# Set permissions
chown -R www-data:www-data "$INSTALL_DIR/dist"
chmod -R 755 "$INSTALL_DIR/dist"

# Restart Apache
systemctl restart apache2

echo -e "${GREEN}✓ Apache configured and restarted${NC}"

# SSL Setup (optional)
echo -e "\n${BLUE}SSL Configuration (Optional)${NC}"
read -p "Install SSL certificate with Certbot? (y/N): " ssl_confirm
if [[ "$ssl_confirm" =~ ^[Yy]$ ]]; then
    if ! command -v certbot &> /dev/null; then
        apt-get install -y certbot python3-certbot-apache
    fi
    
    echo -e "\n${YELLOW}Running Certbot...${NC}"
    certbot --apache -d "$SERVER_NAME" --non-interactive --agree-tos --email "$ADMIN_EMAIL" || {
        echo -e "${YELLOW}Warning: Certbot failed. You can run it manually later:${NC}"
        echo "  sudo certbot --apache -d $SERVER_NAME"
    }
fi

# Firewall setup
echo -e "\n${BLUE}Firewall Configuration${NC}"
read -p "Configure UFW firewall? (y/N): " firewall_confirm
if [[ "$firewall_confirm" =~ ^[Yy]$ ]]; then
    if ! command -v ufw &> /dev/null; then
        apt-get install -y ufw
    fi
    
    # Allow SSH first (important!)
    ufw allow ssh
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Enable if not already active
    if ! ufw status | grep -q "Status: active"; then
        echo "y" | ufw enable
    else
        ufw reload
    fi
    
    echo -e "${GREEN}✓ Firewall configured${NC}"
fi

# Summary
echo -e "\n${GREEN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          Installation Complete! 🎉                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Installation Details:${NC}"
echo -e "  Application: ${GREEN}${INSTALL_DIR}${NC}"
echo -e "  Server: ${GREEN}http://${SERVER_NAME}${NC}"
echo -e "  Apache Config: ${GREEN}${VHOST_FILE}${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Open your browser to http://${SERVER_NAME}"
echo "  2. Go to Settings tab"
echo "  3. Configure database connection"
echo "  4. Add your ESI developer application credentials"
echo "  5. Start syncing data!"
echo ""
echo -e "${YELLOW}Important:${NC}"
echo "  • Database must be set up first (use setup-lmeve-db.sh)"
echo "  • Create ESI app at: https://developers.eveonline.com"
echo "  • Callback URL: http://${SERVER_NAME}/auth/callback"
echo ""
echo -e "${BLUE}Logs:${NC}"
echo "  Apache access: /var/log/apache2/${SERVER_NAME}-access.log"
echo "  Apache error: /var/log/apache2/${SERVER_NAME}-error.log"
echo ""
echo -e "${GREEN}Documentation: ${NC}https://github.com/dstevens79/LmEvE-2/tree/main/scripts"
echo ""
