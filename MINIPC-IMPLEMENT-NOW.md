# Mini PC - New Changes to Implement

This guide covers ONLY the new changes from the latest update that need to be implemented on your Minisforum PC.

## 1. Pull Latest Changes

First, get all the new files:
```bash
git pull origin main
```

## 2. Disable Astro Telemetry

The scripts have been updated to disable telemetry. No action needed - it's already in the scripts.

## 3. Set Up HTTPS (Optional but Recommended)

### Generate SSL Certificate

Run the new certificate generator:
```bash
./generate-certs.sh
```

Or on Windows:
```powershell
# If the .sh script doesn't work, run directly:
mkdir certs
cd certs
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Home/CN=192.168.0.160" -addext "subjectAltName=IP:192.168.0.160,IP:127.0.0.1,DNS:localhost"
cd ..
```

### Start HTTPS Server

Use the new HTTPS hosting script:
```bash
./host-network-https.sh
```

Or for Windows, create and run the PowerShell script from MINIPC-SETUP-GUIDE.md (Section 7).

## 4. Update Windows Scripts

The telemetry disable was added to `start-servers.bat`. Just use the updated version - no manual changes needed.

## That's It!

The main new features are:
- **HTTPS support** - Use `host-network-https.sh` instead of `host-network.sh`
- **Certificate generation** - One-time setup with `generate-certs.sh`
- **Telemetry disabled** - Already in the updated scripts

Everything else was documentation and cleanup. The regular HTTP hosting (`start-servers.bat`) still works exactly the same, just without telemetry now.