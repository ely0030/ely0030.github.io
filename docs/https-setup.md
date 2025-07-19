# HTTPS Setup for Local Network

This guide helps you set up HTTPS for your blog when hosting on your local network.

## Why HTTPS on Local Network?

- **Encryption**: Protects your blog content from being read by others on your network
- **Security**: Prevents tampering with your posts as they travel across the network
- **Modern Features**: Some browser features require HTTPS
- **Peace of Mind**: Especially important if you have IoT devices or guests on your network

## Option 1: Self-Signed Certificate (Recommended for Home Use)

### Step 1: Generate Certificate

Create a self-signed certificate valid for 365 days:

```bash
# Create a directory for certificates
mkdir -p certs
cd certs

# Generate private key and certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes \
  -subj "/C=US/ST=State/L=City/O=Home/CN=192.168.0.160" \
  -addext "subjectAltName=IP:192.168.0.160,IP:127.0.0.1,DNS:localhost"
```

**Important**: Replace `192.168.0.160` with your Minisforum's actual IP address.

### Step 2: Create HTTPS Hosting Script

Create `host-network-https.sh`:

```bash
#!/bin/bash

# Enhanced HTTPS network hosting script
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
    echo "Run the certificate generation command first."
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo -e "\n🛑 Shutting down servers..."
    kill $ASTRO_PID $BLOG_API_PID $PROXY_PID 2>/dev/null
    exit 0
}

trap cleanup EXIT INT TERM

# Start the blog save API server
echo -e "\n📝 Starting Blog Save API Server..."
node blog-save-server.js &
BLOG_API_PID=$!

sleep 2

# Start Astro dev server (HTTP only, on different port)
echo -e "\n🌟 Starting Astro Development Server..."
ASTRO_TELEMETRY_DISABLED=1 npx astro dev --host 0.0.0.0 --port 4320 &
ASTRO_PID=$!

sleep 5

# Start HTTPS proxy using Node.js
echo -e "\n🔒 Starting HTTPS Proxy..."
node -e "
const https = require('https');
const http = require('http');
const fs = require('fs');

const options = {
  key: fs.readFileSync('certs/key.pem'),
  cert: fs.readFileSync('certs/cert.pem')
};

https.createServer(options, (req, res) => {
  const proxy = http.request({
    hostname: 'localhost',
    port: req.url.startsWith('/api') ? 4322 : 4320,
    path: req.url,
    method: req.method,
    headers: req.headers
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  
  req.pipe(proxy);
}).listen(4321, '0.0.0.0', () => {
  console.log('🔒 HTTPS proxy running on https://0.0.0.0:4321');
});
" &
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
echo "⚠️  Certificate Warning:"
echo "   Browsers will show a security warning."
echo "   This is normal for self-signed certificates."
echo "   Click 'Advanced' → 'Proceed' to continue."
echo ""
echo "🛑 Press Ctrl+C to stop the server"
echo "================================================"

wait
```

Make it executable:
```bash
chmod +x host-network-https.sh
```

### Step 3: Trust the Certificate

#### On your devices:

**Chrome/Edge**:
1. Visit `https://192.168.0.160:4321`
2. Click "Advanced" → "Proceed to 192.168.0.160 (unsafe)"
3. The warning will appear each time (normal for self-signed)

**Firefox**:
1. Visit the URL
2. Click "Advanced" → "Accept the Risk and Continue"
3. Firefox remembers the exception

**Mobile (iOS/Android)**:
1. Download `cert.pem` from your Minisforum
2. Install as trusted certificate in device settings
3. iOS: Settings → General → Profiles → Install
4. Android: Settings → Security → Install from storage

## Option 2: Let's Encrypt with DuckDNS (Advanced)

If you want a real certificate without warnings:

1. Sign up for [DuckDNS](https://www.duckdns.org/)
2. Create a subdomain (e.g., `yourblog.duckdns.org`)
3. Point it to your local IP
4. Use certbot with DNS challenge

This is more complex but gives you a real certificate.

## Option 3: Caddy Server (Easiest Real Certificate)

Install Caddy and create `Caddyfile`:

```
yourblog.local {
    reverse_proxy localhost:4321
    tls internal
}
```

Run: `caddy run`

## Security Considerations

### With HTTPS You Get:
✅ **Encrypted traffic** - Content can't be read in transit
✅ **Tamper detection** - Changes to data are detected
✅ **Authentication** - Verify you're connecting to the right server

### Still Missing:
❌ **User authentication** - Anyone on network can still edit
❌ **Access logs** - No record of who accessed what
❌ **Rate limiting** - No protection against abuse

### Additional Security Layers

For more security, consider:

1. **Basic Authentication** (password protection):
   ```javascript
   // Add to blog-save-server.js
   const basicAuth = require('express-basic-auth');
   app.use('/api', basicAuth({
       users: { 'admin': 'your-password-here' },
       challenge: true
   }));
   ```

2. **IP Whitelisting** (only allow specific devices):
   ```javascript
   const allowedIPs = ['192.168.0.100', '192.168.0.101'];
   app.use((req, res, next) => {
       if (!allowedIPs.includes(req.ip)) {
           return res.status(403).send('Forbidden');
       }
       next();
   });
   ```

3. **VPN Access Only**:
   - Set up WireGuard/OpenVPN on your Minisforum
   - Only allow connections through VPN

## Quick Security Assessment

**Your Current Risk Level**:
- ✅ Low risk if: Only trusted family on network
- ⚠️  Medium risk if: Occasional guests, many IoT devices
- ❌ High risk if: Open WiFi, untrusted devices, sensitive content

**Recommendation for Home Use**:
- Self-signed HTTPS is usually sufficient
- Adds encryption without complexity
- Much better than plain HTTP
- Consider basic auth if you have guests often

## Troubleshooting

**"Connection not private" warning**:
- This is normal for self-signed certificates
- The connection is still encrypted
- Click through the warning to proceed

**Can't connect via HTTPS**:
- Check firewall allows port 4321
- Verify certificates exist in `certs/`
- Check all three servers are running (see terminal output)

**Performance issues**:
- HTTPS adds minimal overhead
- If slow, issue is likely elsewhere
- Check CPU usage on Minisforum