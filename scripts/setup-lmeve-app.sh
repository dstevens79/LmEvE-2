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

# (Header removed to make room for left pre-flight checks beside right panel)

# Utility: terminal width
term_cols() {
    if [ -n "$COLUMNS" ]; then echo "$COLUMNS"; return; fi
    if command -v tput >/dev/null 2>&1; then tput cols 2>/dev/null || echo 120; else echo 120; fi
}

# Right-side banner art (drawn with cursor positioning)
draw_right_panel() {
    # Define art block
    local art=(
"┌────────────────────────────────────────────────────┐"
"│                                                    │"
"│   L      M   M  EEEEE  V   V  EEEEE        --      │"
"│   L      MM MM  E      V   V  E          /   |     │"
"│   L      M M M  EEEE    V V   EEEE   ==     /      │" 
"│   L      M   M  E        V    E           /        │"
"│   LLLLL  M   M  EEEEE    V    EEEEE      /____     │"
"│                                                    │"
"│                                                    │" 
"│          LmEvE v2 • Application Installer          │"
"│                                                    │"
"│  ⛭  1–7 edit fields   ↵  Enter to start  Q  quit   │"
"│                                                    │"
"└────────────────────────────────────────────────────┘"
    )

    # Compute placement
    local cols=$(term_cols)
    local art_width=52
    local margin=2
    local start_col=$(( cols - art_width - margin ))
    if [ "$start_col" -lt 56 ]; then start_col=56; fi
    local start_row=1

    # Draw using tput if available
    if command -v tput >/dev/null 2>&1; then
        local i=0
        for line in "${art[@]}"; do
            tput cup $((start_row + i)) "$start_col" 2>/dev/null || true
            echo -e "${BLUE}${line}${NC}"
            i=$((i+1))
        done
    else
        # Fallback: just echo after some spaces
        local pad=""
        local n=$start_col
        while [ $n -gt 0 ]; do pad+=" "; n=$((n-1)); done
        for line in "${art[@]}"; do echo -e "${pad}${BLUE}${line}${NC}"; done
    fi
}

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
check_dep() {
    local name="$1"; shift
    local cmd="$1"; shift
    local ver_cmd="$1"; shift
    # Styled like: checking dependency <name> .... OK (ver)
    printf "checking dependency %-12s .... " "$name"
    if command -v "$cmd" >/dev/null 2>&1; then
        local ver
        if [ -n "$ver_cmd" ]; then
            ver=$(eval "$ver_cmd" 2>/dev/null | head -n1)
        fi
        # Trim noisy version strings for readability
        case "$cmd" in
            curl)
                ver=$(echo "$ver" | awk '{print $1" "$2}')
                ;;
            php)
                ver=$(echo "$ver" | awk '{print $1" "$2}')
                ;;
            apache2)
                ver=$(echo "$ver" | sed 's/^Server version: //')
                ;;
        esac
        echo -e "${GREEN}OK${NC}${ver:+  ($ver)}"
        return 0
    else
        echo -e "${YELLOW}MISSING${NC}"
        return 1
    fi
}

draw_preflight_header() {
    # A compact title bar similar to the screenshot
    local title_left="${BLUE}LmEvE v2${NC}"
    local title_right="${GREEN}Pre-flight checks${NC}"
    # Build a simple boxed header
    local line_top="┌───────────────────────────────────────────────┐"
    local line_mid
    # Compose center text with padding (fixed width ~47)
    line_mid="│ ${title_left} , ${title_right} │"
    local line_bot="└───────────────────────────────────────────────┘"
    echo -e "${BLUE}${line_top}${NC}"
    echo -e "${line_mid}"
    echo -e "${BLUE}${line_bot}${NC}"
}

draw_preflight() {
    draw_preflight_header
    local MISSING_DEPS=0
    check_dep "curl"    curl   "curl --version" || MISSING_DEPS=$((MISSING_DEPS+1))
    check_dep "git"     git    "git --version"   || MISSING_DEPS=$((MISSING_DEPS+1))
    check_dep "Apache"  apache2 "apache2 -v"     || MISSING_DEPS=$((MISSING_DEPS+1))
    check_dep "PHP"     php    "php -v"          || MISSING_DEPS=$((MISSING_DEPS+1))
    check_dep "Node.js" node   "node -v"         || MISSING_DEPS=$((MISSING_DEPS+1))
    check_dep "npm"     npm    "npm -v"          || MISSING_DEPS=$((MISSING_DEPS+1))
    check_dep "ufw"     ufw    "ufw --version"   || true
    check_dep "certbot" certbot "certbot --version" || true

    if [ "$MISSING_DEPS" -gt 0 ]; then
        echo -e "${YELLOW}Some components are missing and will be installed.${NC}"
    else
        echo -e "${GREEN}All required dependencies are present.${NC}"
    fi
}

# -----------------------------------------------------
# Upfront configuration menu (static redraw)
# Behavior:
#  - Number press on Yes/No fields toggles value immediately
#  - Number press on text fields prompts for new text (replaces on refresh)
#  - Access method toggles IP <-> Domain on press
# -----------------------------------------------------
DEFAULT_DIR="/var/www/html/lmeve2"
FINAL_DIR="$DEFAULT_DIR"
ACCESS_METHOD=1 # 1=IP, 2=Domain
SERVER_NAME=""  # used when ACCESS_METHOD=2 (Domain) 
HTTP_PORT=80
ADMIN_EMAIL="admin@lmeve2.local"
ENABLE_SSL="N"
CONFIG_FIREWALL="N"

first_ip() { hostname -I 2>/dev/null | awk '{print $1}' | sed 's/\s.*//' ; }

draw_menu() {
    clear 2>/dev/null || tput clear 2>/dev/null || true
    # Draw large right-side moniker
    draw_right_panel
    # Show pre-flight dependency checks above the menu (read-only)
    draw_preflight
    echo ""
    echo -e "${BLUE}Installer Options (press 1-7 to edit, Enter=Start, Q=Quit)${NC}"
    echo ""
    # 1) Access method
    local am_label=$([ "$ACCESS_METHOD" -eq 1 ] && echo "IP" || echo "Domain")
    printf "  1) Access method         : %s\n" "$am_label"
    # 2) Server name/domain
    if [ "$ACCESS_METHOD" -eq 1 ]; then
        printf "  2) Server name/domain    : [auto] %s\n" "$(first_ip)"
    else
        printf "  2) Server name/domain    : %s\n" "${SERVER_NAME:-lmeve2.local}"
    fi
    # 3) HTTP port
    printf "  3) HTTP port             : %s\n" "$HTTP_PORT"
    # 4) Admin email
    printf "  4) Admin email           : %s\n" "$ADMIN_EMAIL"
    # 5) Install directory
    printf "  5) Install directory     : %s\n" "$FINAL_DIR"
    # 6) SSL toggle
    local SSL_LABEL=$([[ "$ENABLE_SSL" =~ ^[Yy]$ ]] && echo "Yes" || echo "No")
    printf "  6) Install SSL (certbot) : %s\n" "$SSL_LABEL"
    # 7) Firewall toggle
    local FW_LABEL=$([[ "$CONFIG_FIREWALL" =~ ^[Yy]$ ]] && echo "Yes" || echo "No")
    printf "  7) Configure UFW firewall: %s\n" "$FW_LABEL"
    echo ""
}

while true; do
    draw_menu
    read -r -p "Select [1-7], Enter=Start, Q=Quit: " choice || true; echo ""
    # Strip all whitespace from input for robust matching
    choice_clean="${choice//[[:space:]]/}"
    # Empty input -> start install
    if [ -z "$choice_clean" ]; then
        break
    fi
    case "${choice_clean^^}" in
        1)
            # Toggle access method
            if [ "$ACCESS_METHOD" -eq 1 ]; then ACCESS_METHOD=2; else ACCESS_METHOD=1; fi
            ;;
        2)
            # Prompt for domain when in Domain mode
            if [ "$ACCESS_METHOD" -eq 2 ]; then
                read -r -p "Enter server name/domain [${SERVER_NAME:-lmeve2.local}]: " sn
                SERVER_NAME=${sn:-${SERVER_NAME:-lmeve2.local}}
            fi
            ;;
        3)
            read -r -p "Enter HTTP port [${HTTP_PORT}]: " hp
            hp=${hp:-$HTTP_PORT}
            if [[ "$hp" =~ ^[0-9]{2,5}$ ]]; then
                HTTP_PORT=$hp
            else
                echo -e "${YELLOW}Invalid port. Keeping ${HTTP_PORT}.${NC}"
                sleep 1
            fi
            ;;
        4)
            read -r -p "Enter admin email [${ADMIN_EMAIL}]: " ae
            ADMIN_EMAIL=${ae:-$ADMIN_EMAIL}
            ;;
        5)
            read -r -p "Install directory [${FINAL_DIR}]: " id
            FINAL_DIR=${id:-$FINAL_DIR}
            ;;
        6)
            # Toggle SSL
            if [[ "$ENABLE_SSL" =~ ^[Yy]$ ]]; then ENABLE_SSL="N"; else ENABLE_SSL="Y"; fi
            ;;
        7)
            # Toggle firewall
            if [[ "$CONFIG_FIREWALL" =~ ^[Yy]$ ]]; then CONFIG_FIREWALL="N"; else CONFIG_FIREWALL="Y"; fi
            ;;
        Q)
            echo "Exiting installer."
            exit 0
            ;;
        *)
            # Any other text -> treat as invalid and refresh menu
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
