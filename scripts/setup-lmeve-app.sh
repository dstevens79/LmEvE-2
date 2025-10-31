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
echo "║          LmEvEv2 Application Installer            ║"
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


# -----------------------------------------------------
# Dependency checks (read-only)
# -----------------------------------------------------
echo -e "\n${GREEN}1. Pre-flight checks${NC}"

check_dep() {
    local name="$1"; shift
    local cmd="$1"; shift
    local ver_cmd="$1"; shift
    printf "checking dependancy %-18s .... " "$name"
    if command -v "$cmd" >/dev/null 2>&1; then
        local ver
        if [ -n "$ver_cmd" ]; then
            ver=$(eval "$ver_cmd" 2>/dev/null | head -n1)
        fi
        echo -e "${GREEN}OK${NC}${ver:+  ($ver)}"
        return 0
    else
        echo -e "${YELLOW}MISSING${NC}"
        return 1
    fi
}

MISSING_DEPS=0
check_dep "curl"    curl   "curl --version" || MISSING_DEPS=$((MISSING_DEPS+1))
check_dep "git"     git    "git --version"   || MISSING_DEPS=$((MISSING_DEPS+1))
check_dep "Apache"  apache2 "apache2 -v"     || MISSING_DEPS=$((MISSING_DEPS+1))
check_dep "PHP"     php    "php -v"          || MISSING_DEPS=$((MISSING_DEPS+1))
check_dep "Node.js" node   "node -v"         || MISSING_DEPS=$((MISSING_DEPS+1))
check_dep "npm"     npm    "npm -v"          || MISSING_DEPS=$((MISSING_DEPS+1))
check_dep "ufw"     ufw    "ufw --version"   || true
check_dep "certbot" certbot "certbot --version" || true

if [ "$MISSING_DEPS" -gt 0 ]; then
    echo -e "${YELLOW}Some required components are missing and will be installed.${NC}"
else
    echo -e "${GREEN}All required dependencies are present.${NC}"
fi

# -----------------------------------------------------
# Upfront configuration menu
# -----------------------------------------------------
DEFAULT_DIR="/var/www/html/lmeve2"
FINAL_DIR="$DEFAULT_DIR"
ACCESS_METHOD=1 # 1=IP, 2=Domain
SERVER_NAME=""
HTTP_PORT=80
ADMIN_EMAIL="admin@lmeve2.local"
ENABLE_SSL="N"
CONFIG_FIREWALL="N"

first_ip() { hostname -I 2>/dev/null | awk '{print $1}' | sed 's/\s.*//' ; }

while true; do
    echo -e "\n${BLUE}Installer Options${NC}"
    echo "  1) Access method         : ${ACCESS_METHOD}  (1=IP, 2=Domain)"
    if [ "$ACCESS_METHOD" -eq 1 ]; then
        echo "  2) Server name/domain    : [auto] $(first_ip)"
    else
        echo "  2) Server name/domain    : ${SERVER_NAME:-lmeve2.local}"
    fi
    echo "  3) HTTP port             : ${HTTP_PORT}"
    echo "  4) Admin email           : ${ADMIN_EMAIL}"
    echo "  5) Install directory     : ${FINAL_DIR}"
    echo "  6) Install SSL (certbot) : ${ENABLE_SSL}"
    echo "  7) Configure UFW firewall: ${CONFIG_FIREWALL}"
    echo "  P) Proceed with installation"
    echo "  Q) Quit"
    read -p "Choose an option to change (1-7), P to proceed, Q to quit: " choice
    case "${choice^^}" in
        1)
            read -p "Select access method [1=IP, 2=Domain]: " am
            if [ "$am" = "2" ]; then ACCESS_METHOD=2; else ACCESS_METHOD=1; fi
            ;;
        2)
            if [ "$ACCESS_METHOD" -eq 2 ]; then
                read -p "Enter server name/domain [lmeve2.local]: " sn
                SERVER_NAME=${sn:-lmeve2.local}
            else
                echo "Using IP access; server name is auto-detected."
            fi
            ;;
        3)
            read -p "Enter HTTP port [80]: " hp
            HTTP_PORT=${hp:-80}
            ;;
        4)
            read -p "Enter admin email [admin@lmeve2.local]: " ae
            ADMIN_EMAIL=${ae:-admin@lmeve2.local}
            ;;
        5)
            read -p "Install directory [${DEFAULT_DIR}]: " id
            FINAL_DIR=${id:-$DEFAULT_DIR}
            ;;
        6)
            read -p "Install SSL with certbot? (Y/N) [${ENABLE_SSL}]: " ss
            ss=${ss:-$ENABLE_SSL}
            if [[ "$ss" =~ ^[Yy]$ ]]; then ENABLE_SSL="Y"; else ENABLE_SSL="N"; fi
            ;;
        7)
            read -p "Configure UFW firewall? (Y/N) [${CONFIG_FIREWALL}]: " fw
            fw=${fw:-$CONFIG_FIREWALL}
            if [[ "$fw" =~ ^[Yy]$ ]]; then CONFIG_FIREWALL="Y"; else CONFIG_FIREWALL="N"; fi
            ;;
        P)
            break
            ;;
        Q)
            echo "Exiting installer."
            exit 0
            ;;
        *)
            echo "Invalid option"
            ;;
    esac
done

# Materialize selected options
if [ "$ACCESS_METHOD" -eq 1 ]; then
    USE_IP=true
    SERVER_NAME=$(first_ip)
else
    USE_IP=false
    SERVER_NAME=${SERVER_NAME:-lmeve2.local}
fi

if [ "$HTTP_PORT" != "80" ]; then
    echo -e "${YELLOW}Note: You'll access the site at http://${SERVER_NAME}:${HTTP_PORT}${NC}"
fi

echo -e "\n${GREEN}2. System Update${NC}"
echo "Updating package lists..."
apt-get update -qq
echo "Upgrading packages and removing obsolete ones..."
apt-get upgrade -y
apt-get autoremove -y
apt-get autoclean -y
echo -e "${GREEN}✓ System updated and cleaned${NC}"

echo -e "\n${GREEN}3. Installing Node.js 20.x${NC}"
if ! command -v node &> /dev/null || [[ ! "$(node -v)" =~ ^v20 ]]; then
    echo "Installing Node.js 20.x from NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    echo -e "${GREEN}✓ Node.js $(node -v) installed${NC}"
else
    echo -e "${GREEN}✓ Node.js $(node -v) already installed${NC}"
fi

echo -e "\n${GREEN}4. Installing Apache Web Server${NC}"
if ! command -v apache2 &> /dev/null; then
    apt-get install -y apache2
    systemctl enable apache2
    systemctl start apache2
    echo -e "${GREEN}✓ Apache installed and started${NC}"
else
    echo -e "${GREEN}✓ Apache already installed${NC}"
fi

echo -e "\n${GREEN}4b. Installing PHP for API endpoints${NC}"
if ! command -v php &> /dev/null; then
    apt-get install -y php libapache2-mod-php php-mysql
    systemctl restart apache2
    echo -e "${GREEN}✓ PHP and MySQL extensions installed${NC}"
else
    # Ensure MySQL extension and Apache PHP module are present
    apt-get install -y libapache2-mod-php php-mysql
    systemctl restart apache2
    echo -e "${GREEN}✓ PHP already installed; ensured Apache PHP module and MySQL extension${NC}"
fi

echo -e "\n${GREEN}5. Installing Git${NC}"
if ! command -v git &> /dev/null; then
    apt-get install -y git
    echo -e "${GREEN}✓ Git installed${NC}"
else
    echo -e "${GREEN}✓ Git already installed${NC}"
fi

# Temporary build directory
BUILD_DIR="/tmp/lmeve2-build-$$"

echo -e "\n${BLUE}Selected configuration${NC}"
echo "  Access method      : $([ "$USE_IP" = true ] && echo IP || echo Domain)"
echo "  Server name/domain : ${SERVER_NAME}"
echo "  HTTP port          : ${HTTP_PORT}"
echo "  Admin email        : ${ADMIN_EMAIL}"
echo "  Install directory  : ${FINAL_DIR}"
echo "  SSL (certbot)      : ${ENABLE_SSL}"
echo "  UFW firewall       : ${CONFIG_FIREWALL}"

echo -e "\n${GREEN}6. Cloning Repository to Temporary Location${NC}"
echo "Build directory: ${BUILD_DIR}"
git clone https://github.com/dstevens79/LmEvE-2.git "$BUILD_DIR"
echo -e "${GREEN}✓ Repository cloned${NC}"

cd "$BUILD_DIR"

echo -e "\n${GREEN}7. Installing Dependencies${NC}"
echo "Running npm install (this may take a few minutes)..."
npm install --silent
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo -e "\n${GREEN}8. Building Application${NC}"
npm run build
echo -e "${GREEN}✓ Build complete${NC}"

echo -e "\n${GREEN}9. Deploying Application${NC}"
# Change back to safe directory before deleting build dir
cd /tmp

# Remove old deployment if exists
if [ -d "$FINAL_DIR" ]; then
    echo "Removing old deployment..."
    rm -rf "$FINAL_DIR"
fi

# Move the dist folder and rename it
echo "Moving dist to ${FINAL_DIR}..."
mv "$BUILD_DIR/dist" "$FINAL_DIR"
echo -e "${GREEN}✓ Application deployed${NC}"

echo -e "\n${GREEN}10. Cleaning Up Build Files${NC}"
echo "Removing temporary build directory..."
rm -rf "$BUILD_DIR"
echo -e "${GREEN}✓ Build files cleaned (saved ~500MB)${NC}"

echo -e "\n${GREEN}11. Configuring Apache${NC}"

# Enable required modules
a2enmod rewrite
a2enmod headers
a2enmod ssl

# Create Apache config
if [ "$USE_IP" = true ]; then
    # IP-based configuration
    VHOST_FILE="/etc/apache2/sites-available/lmeve2.conf"
    
    cat > "$VHOST_FILE" << EOF
<VirtualHost *:${HTTP_PORT}>
    ServerAdmin ${ADMIN_EMAIL}
    
    DocumentRoot ${FINAL_DIR}
    
    <Directory ${FINAL_DIR}>
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
    
    ErrorLog \${APACHE_LOG_DIR}/lmeve2-error.log
    CustomLog \${APACHE_LOG_DIR}/lmeve2-access.log combined
</VirtualHost>
EOF
    
    # Enable site
    a2ensite lmeve2.conf
else
    # Domain-based configuration
    VHOST_FILE="/etc/apache2/sites-available/${SERVER_NAME}.conf"
    
    cat > "$VHOST_FILE" << EOF
<VirtualHost *:${HTTP_PORT}>
    ServerName ${SERVER_NAME}
    ServerAdmin ${ADMIN_EMAIL}
    
    DocumentRoot ${FINAL_DIR}
    
    <Directory ${FINAL_DIR}>
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
fi

# Disable default site if enabled
a2dissite 000-default.conf 2>/dev/null || true

# Configure custom port if needed
if [ "$HTTP_PORT" != "80" ]; then
    # Add Listen directive if not already present
    if ! grep -q "^Listen ${HTTP_PORT}" /etc/apache2/ports.conf; then
        echo "Listen ${HTTP_PORT}" >> /etc/apache2/ports.conf
        echo -e "${GREEN}✓ Added Listen ${HTTP_PORT} to ports.conf${NC}"
    fi
fi

# Set permissions
chown -R www-data:www-data "$FINAL_DIR"
chmod -R 755 "$FINAL_DIR"

# Restart Apache
systemctl restart apache2

echo -e "${GREEN}✓ Apache configured and restarted${NC}"

# SSL Setup (optional)
if [[ "$ENABLE_SSL" =~ ^[Yy]$ ]]; then
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
if [[ "$CONFIG_FIREWALL" =~ ^[Yy]$ ]]; then
    if ! command -v ufw &> /dev/null; then
        apt-get install -y ufw
    fi
    
    # Allow SSH first (important!)
    ufw allow ssh
    ufw allow ${HTTP_PORT}/tcp
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
echo -e "  Application: ${GREEN}${FINAL_DIR}${NC}"
if [ "$HTTP_PORT" == "80" ]; then
    echo -e "  URL: ${GREEN}http://${SERVER_NAME}${NC}"
else
    echo -e "  URL: ${GREEN}http://${SERVER_NAME}:${HTTP_PORT}${NC}"
fi
echo -e "  Apache Config: ${GREEN}${VHOST_FILE}${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
if [ "$HTTP_PORT" == "80" ]; then
    echo "  1. Open your browser to http://${SERVER_NAME}"
else
    echo "  1. Open your browser to http://${SERVER_NAME}:${HTTP_PORT}"
fi
echo "  2. Go to Settings tab"
echo "  3. Configure database connection"
echo "  4. Add your ESI developer application credentials"
echo "  5. Start syncing data!"
echo ""
echo -e "${YELLOW}Important:${NC}"
echo "  • Database must be set up first (use setup-lmeve-db.sh)"
echo "  • Create ESI app at: https://developers.eveonline.com"
if [ "$HTTP_PORT" == "80" ]; then
    echo "  • Callback URL: http://${SERVER_NAME}/api/auth/esi/callback.php"
else
    echo "  • Callback URL: http://${SERVER_NAME}:${HTTP_PORT}/api/auth/esi/callback.php"
fi
echo ""
echo -e "${BLUE}Logs:${NC}"
if [ "$USE_IP" = true ]; then
    echo "  Apache access: /var/log/apache2/lmeve2-access.log"
    echo "  Apache error: /var/log/apache2/lmeve2-error.log"
else
    echo "  Apache access: /var/log/apache2/${SERVER_NAME}-access.log"
    echo "  Apache error: /var/log/apache2/${SERVER_NAME}-error.log"
fi
echo ""
echo -e "${GREEN}Documentation: ${NC}https://github.com/dstevens79/LmEvE-2/tree/main/scripts"
echo ""
