#!/bin/bash

# Enhanced network hosting script for ely0030's blog
# This script runs both the Astro dev server and the blog save API server
# allowing full blog editing capabilities from any device on the network

echo "🚀 Starting ely0030's Blog Network Server"
echo "================================================"

# Get the local IP address
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    LOCAL_IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1)
else
    # Linux
    LOCAL_IP=$(hostname -I | awk '{print $1}')
fi

if [ -z "$LOCAL_IP" ]; then
    echo "⚠️  Could not determine local IP address"
    echo "Using localhost only..."
    LOCAL_IP="localhost"
else
    echo "📡 Network IP: $LOCAL_IP"
fi

# Export environment variables for the servers
export HOST="0.0.0.0"  # Listen on all interfaces
export LOCAL_IP="$LOCAL_IP"
export ASTRO_TELEMETRY_DISABLED=1  # Disable Astro telemetry

# Function to cleanup on exit
cleanup() {
    echo -e "\n🛑 Shutting down servers..."
    kill $ASTRO_PID $BLOG_API_PID 2>/dev/null
    exit 0
}

# Set up cleanup trap
trap cleanup EXIT INT TERM

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the blog save API server in the background
echo -e "\n📝 Starting Blog Save API Server..."
node blog-save-server-secure.js &
BLOG_API_PID=$!

# Give the API server a moment to start
sleep 2

# Check if .nvmrc exists and source nvm if needed
if [ -f .nvmrc ] && [ -f "$HOME/.nvm/nvm.sh" ]; then
    echo -e "\n📦 Loading Node version from .nvmrc..."
    source "$HOME/.nvm/nvm.sh"
    nvm use
fi

# Start Astro dev server with host binding
echo -e "\n🌟 Starting Astro Development Server..."
echo "This will take a moment to build..."

# Run Astro with network host binding and telemetry disabled
ASTRO_TELEMETRY_DISABLED=1 npx astro dev --host 0.0.0.0 &
ASTRO_PID=$!

# Wait for Astro to start
echo -e "\n⏳ Waiting for servers to start..."
sleep 5

# Display access information
echo -e "\n✅ Blog is now accessible on your network!"
echo "================================================"
echo "📱 Access from any device on your network:"
echo "   🌐 http://$LOCAL_IP:4321"
echo ""
echo "💻 Local access:"
echo "   🌐 http://localhost:4321"
echo ""
echo "📝 Notepad editor with save functionality:"
echo "   ✏️  http://$LOCAL_IP:4321/notepad"
echo ""
echo "🔒 Security Note:"
echo "   This server is accessible to all devices on your local network."
echo "   Do not use on public WiFi networks."
echo ""
echo "🛑 Press Ctrl+C to stop the server"
echo "================================================"

# Keep the script running
wait