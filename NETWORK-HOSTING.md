
# 🌐 Network Hosting Guide

Host your blog on your local network for access from any device!

## 🚀 Quick Start

This guide contains instructions for both Linux and Windows.

**For Linux:**
```bash
./host-network.sh
```

**For Windows:**
See the "Windows Setup" section below for manual instructions. A `host-network.ps1` script is also available for convenience.

## 📱 Access Your Blog

After running the script, you'll see something like:
```
📱 Access from any device on your network:
   🌐 http://192.168.1.100:4321
```

Open that URL on your phone, tablet, or any device on your network!

## ✨ What You Can Do

- **Browse** your entire blog from any device
- **Edit posts** using the notepad at `/notepad`
- **Create new posts** with full markdown support
- **Paste images** that auto-save to your server
- **All changes save** back to your Minisforum PC

## 🔧 Setup Details

### What's Included

1. **`host-network.sh`** - Main hosting script that runs everything
2. **Network-enabled servers** - Both Astro and save API configured for network access
3. **`ely-blog.service`** - Systemd service for auto-start on boot (Linux)
4. **Full documentation** - See `docs/network-hosting-setup.md` for detailed info

### Auto-Start on Boot (Linux)

1. Edit `ely-blog.service` - Update YOUR_USERNAME and paths
2. Copy to systemd:
   ```bash
   sudo cp ely-blog.service /etc/systemd/system/
   sudo systemctl enable ely-blog
   sudo systemctl start ely-blog
   ```

### Firewall Rules (if needed)

```bash
# Linux
sudo ufw allow 4321/tcp
sudo ufw allow 4322/tcp

# Windows
# Windows Firewall will typically prompt you to allow access for Node.js the 
# first time you run the servers. If not, you may need to add manual rules 
# for TCP ports 4321 and 4322.
```

## 🔒 Security Notes

- **Local network only** - Not accessible from the internet
- **No authentication** - Anyone on your WiFi can edit
- **Don't use on public WiFi** - Only trusted networks

## 🛠️ Troubleshooting

**Can't connect from other devices?**
- Check the IP address shown in terminal
- Verify firewall settings
- Ensure devices are on same WiFi network

**Save not working?**
- Check browser console for errors
- Verify both servers are running (ports 4321 & 4322)

**Browser Error: `net::ERR_BLOCKED_BY_CLIENT`**
- This error is caused by a browser extension (like an ad-blocker) blocking the save request because it's on a different port.
- The fix is to use the Astro dev server's proxy to route API requests. See `astro.config.mjs` for the proxy configuration.

**Terminal Error: `ECONNREFUSED ::1:4322`**
- This happens if the API server isn't running or if there's an IPv6/IPv4 mismatch between the Astro proxy and the API server.
- **Solution 1:** Ensure the API server (`node blog-save-server.js`) is running in a separate terminal.
- **Solution 2:** Update `astro.config.mjs` to force the proxy to use the IPv4 address:
  ```javascript
  // astro.config.mjs
  server: {
      proxy: {
          '/api': {
              target: 'http://127.0.0.1:4322', // Use 127.0.0.1 instead of localhost
              changeOrigin: true
          }
      }
  }
  ```

**Astro fails with Node.js version error**
- Astro requires a specific minimum version of Node.js (e.g., `>=18.20.8`).
- Check your version with `node --version` and upgrade if necessary from the [official Node.js website](https://nodejs.org/).

**`npm install` seems broken or commands fail**
- A corrupted `node_modules` directory can cause strange errors.
- **Solution:** Delete `node_modules` and `package-lock.json`, then run `npm install` again.
  ```powershell
  Remove-Item -Recurse -Force node_modules
  Remove-Item -Force package-lock.json
  npm install
  ```

**Need help?**
- See the new `minipc-server-info.md` for a full Windows setup guide.
- Check terminal output for specific errors

## 🎯 Perfect For

- Writing from your couch on your phone
- Showing your blog to friends
- Editing from multiple computers
- Having a personal blog server at home

Enjoy your network-accessible blog! 🎉