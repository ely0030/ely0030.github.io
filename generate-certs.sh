#!/bin/bash

# Certificate generation helper for HTTPS setup
echo "🔐 Generating Self-Signed Certificate for HTTPS"
echo "=============================================="

# Get the local IP address
if [[ "$OSTYPE" == "darwin"* ]]; then
    LOCAL_IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1)
else
    LOCAL_IP=$(hostname -I | awk '{print $1}')
fi

if [ -z "$LOCAL_IP" ]; then
    echo "⚠️  Could not determine local IP address"
    echo "Please enter your Minisforum's IP address manually:"
    read LOCAL_IP
fi

echo "📡 Using IP address: $LOCAL_IP"
echo ""

# Create certs directory
mkdir -p certs
cd certs

# Check if certificates already exist
if [ -f "cert.pem" ] && [ -f "key.pem" ]; then
    echo "⚠️  Certificates already exist in certs/ directory!"
    echo "Delete them first if you want to regenerate."
    exit 1
fi

# Generate the certificate
echo "🔨 Generating certificate..."
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes \
  -subj "/C=US/ST=HomeState/L=HomeCity/O=Home/CN=$LOCAL_IP" \
  -addext "subjectAltName=IP:$LOCAL_IP,IP:127.0.0.1,DNS:localhost" 2>/dev/null

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Certificate generated successfully!"
    echo ""
    echo "📁 Files created:"
    echo "   - certs/cert.pem (certificate)"
    echo "   - certs/key.pem (private key)"
    echo ""
    echo "🔒 Certificate details:"
    echo "   - Valid for: 365 days"
    echo "   - IP addresses: $LOCAL_IP, 127.0.0.1"
    echo "   - Hostname: localhost"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Run ./host-network-https.sh to start HTTPS server"
    echo "   2. Accept the certificate warning in your browser"
    echo "   3. Access your blog at https://$LOCAL_IP:4321"
else
    echo ""
    echo "❌ Failed to generate certificate!"
    echo "Make sure OpenSSL is installed: apt-get install openssl"
fi