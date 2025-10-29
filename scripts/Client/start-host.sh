#!/bin/bash
# GetMe Package Host Startup Script
# Starts the hosting server for LMeve GetMe packages

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Default port - can be overridden
PORT="${1:-3456}"

echo "🚀 Starting GetMe Package Host..."
echo "📁 Working directory: $SCRIPT_DIR"
echo "🌐 Port: $PORT"
echo ""

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed"
    echo "Please install Node.js to run the hosting server"
    exit 1
fi

# Check if the host server exists
if [ ! -f "host-server.js" ]; then
    echo "❌ host-server.js not found in current directory"
    echo "Make sure you're running this from the scripts/Client directory"
    exit 1
fi

# Check if getme-generator.js exists (compiled from TS)
if [ ! -f "getme-generator.js" ]; then
    echo "⚠️  getme-generator.js not found - attempting to use TypeScript directly"
    # Note: In production, you'd want to compile TS to JS first
fi

echo "Starting server..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Start the server
node host-server.js "$PORT"