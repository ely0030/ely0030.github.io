#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
nvm use 18.17.1

# Auto-convert literature files from drafts folder
echo "🔄 Checking for markdown files to convert..."
node src/utils/auto-convert-literature.js
echo ""

# Start the blog save server in background
echo "📝 Starting blog save server..."
node blog-save-server.js &
SAVE_SERVER_PID=$!

# Function to cleanup on exit
cleanup() {
    echo "🛑 Shutting down blog save server..."
    kill $SAVE_SERVER_PID 2>/dev/null
    exit
}

# Set up cleanup on script exit
trap cleanup EXIT INT TERM

# Start the dev server
astro dev 