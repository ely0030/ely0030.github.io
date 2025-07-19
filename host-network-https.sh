#!/bin/bash

# Enhanced HTTPS network hosting script for ely0030's blog
echo "🔒 Starting ely0030's Blog HTTPS Network Server"
echo "================================================"

# Get the local IP address
if [[ "$OSTYPE" == "darwin"* ]]; then
    LOCAL_IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1)
else
    LOCAL_IP=$(hostname -I | awk '{print $1}')
fi

if [ -z "$LOCAL_IP" ]; then
    echo "⚠️  Could not determine local IP address"
    LOCAL_IP="localhost"
else
    echo "📡 Network IP: $LOCAL_IP"
fi

# Export environment variables
export HOST="0.0.0.0"
export LOCAL_IP="$LOCAL_IP"
export ASTRO_TELEMETRY_DISABLED=1

# Check if certificates exist
if [ ! -f "certs/cert.pem" ] || [ ! -f "certs/key.pem" ]; then
    echo "❌ Certificates not found in certs/ directory!"
    echo ""
    echo "To generate self-signed certificates, run:"
    echo ""
    echo "mkdir -p certs && cd certs"
    echo "openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes \\"
    echo "  -subj \"/C=US/ST=State/L=City/O=Home/CN=$LOCAL_IP\" \\"
    echo "  -addext \"subjectAltName=IP:$LOCAL_IP,IP:127.0.0.1,DNS:localhost\""
    echo ""
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo -e "\n🛑 Shutting down servers..."
    kill $ASTRO_PID $BLOG_API_PID $PROXY_PID 2>/dev/null
    exit 0
}

trap cleanup EXIT INT TERM

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the blog save API server
echo -e "\n📝 Starting Blog Save API Server..."
node blog-save-server.js &
BLOG_API_PID=$!

sleep 2

# Check if .nvmrc exists and source nvm if needed
if [ -f .nvmrc ] && [ -f "$HOME/.nvm/nvm.sh" ]; then
    echo -e "\n📦 Loading Node version from .nvmrc..."
    source "$HOME/.nvm/nvm.sh"
    nvm use
fi

# Start Astro dev server (HTTP only, on different port)
echo -e "\n🌟 Starting Astro Development Server..."
ASTRO_TELEMETRY_DISABLED=1 npx astro dev --host 0.0.0.0 --port 4320 &
ASTRO_PID=$!

echo -e "\n⏳ Waiting for servers to start..."
sleep 5

# Create HTTPS proxy script
cat > /tmp/https-proxy.js << 'EOF'
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const options = {
  key: fs.readFileSync('certs/key.pem'),
  cert: fs.readFileSync('certs/cert.pem')
};

https.createServer(options, (req, res) => {
  // Determine target port based on URL
  const targetPort = req.url.startsWith('/api') ? 4322 : 4320;
  
  const proxyOptions = {
    hostname: '127.0.0.1',
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: {...req.headers, host: `localhost:${targetPort}`}
  };

  const proxy = http.request(proxyOptions, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  
  proxy.on('error', (err) => {
    console.error('Proxy error:', err);
    res.writeHead(502);
    res.end('Bad Gateway');
  });
  
  req.pipe(proxy);
}).listen(4321, '0.0.0.0', () => {
  console.log('🔒 HTTPS proxy running on https://0.0.0.0:4321');
});
EOF

# Start HTTPS proxy
echo -e "\n🔒 Starting HTTPS Proxy..."
node /tmp/https-proxy.js &
PROXY_PID=$!

# Display access information
echo -e "\n✅ Blog is now accessible via HTTPS!"
echo "================================================"
echo "🔒 Secure access from any device:"
echo "   🌐 https://$LOCAL_IP:4321"
echo ""
echo "💻 Local access:"
echo "   🌐 https://localhost:4321"
echo ""
echo "📝 Notepad editor:"
echo "   ✏️  https://$LOCAL_IP:4321/notepad"
echo ""
echo "⚠️  Certificate Warning:"
echo "   Browsers will show a security warning."
echo "   This is normal for self-signed certificates."
echo "   Click 'Advanced' → 'Proceed' to continue."
echo ""
echo "🔐 Security Status:"
echo "   ✅ Traffic encrypted (HTTPS)"
echo "   ✅ Telemetry disabled"
echo "   ⚠️  No authentication (anyone on network can edit)"
echo ""
echo "🛑 Press Ctrl+C to stop the server"
echo "================================================"

# Keep the script running
wait