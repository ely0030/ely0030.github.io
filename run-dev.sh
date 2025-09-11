#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
nvm use 20.19.2

# Auto-convert literature files from drafts folder
echo "🔄 Checking for markdown files to convert..."
node src/utils/auto-convert-literature.js
echo ""

# Start the blog save server in background
echo "📝 Starting blog save server..."
node blog-save-server-secure.js &
SAVE_SERVER_PID=$!

# Function to cleanup on exit
cleanup() {
    echo "🛑 Shutting down blog save server..."
    kill $SAVE_SERVER_PID 2>/dev/null
    exit
}

# Set up cleanup on script exit
trap cleanup EXIT INT TERM

# Start the dev server with telemetry disabled
# Force polling so file changes on /mnt/c are detected under WSL
export CHOKIDAR_USEPOLLING=1
export CHOKIDAR_INTERVAL=300
ASTRO_TELEMETRY_DISABLED=1 npx astro dev 
