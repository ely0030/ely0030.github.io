#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
nvm use 18.17.1

echo "🔒 Starting PROTECTED development server"
echo "Authentication required to view ANY page"
echo ""

# Check for .env file
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Create it with: echo 'BLOG_AUTH_PASSWORD=your-password' > .env"
    exit 1
fi

# Auto-convert literature files from drafts folder
echo "🔄 Checking for markdown files to convert..."
node src/utils/auto-convert-literature.js
echo ""

# Start the blog save server in background
echo "📝 Starting secure blog save server..."
node blog-save-server-secure.js &
SAVE_SERVER_PID=$!

# Function to cleanup on exit
cleanup() {
    echo "🛑 Shutting down servers..."
    kill $SAVE_SERVER_PID 2>/dev/null
    kill $PROXY_PID 2>/dev/null
    exit
}

# Set up cleanup on script exit
trap cleanup EXIT INT TERM

# Start the dev server with telemetry disabled
echo "🚀 Starting Astro dev server..."
ASTRO_TELEMETRY_DISABLED=1 astro dev --port 4321 &
ASTRO_PID=$!

# Wait for Astro to start
sleep 5

# Start the protected HTTPS proxy
echo "🔐 Starting protected HTTPS proxy..."
LISTEN_PORT=4320 ASTRO_PORT=4321 API_PORT=4322 node https-proxy-protected.cjs &
PROXY_PID=$!

echo ""
echo "✅ Protected development server running!"
echo ""
echo "Access at: https://localhost:4320"
echo "⚠️  You MUST login to view any page"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for any background job to exit
wait