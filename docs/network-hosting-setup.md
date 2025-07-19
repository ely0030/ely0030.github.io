# Network Hosting Setup

This guide explains how to host your blog on your local network for network-wide access.

## Quick Start

*   **On Windows**:
    ```powershell
    # This provides a secure, HTTPS server
    powershell -ExecutionPolicy Bypass -File host-network-https.ps1
    ```

*   **On Linux/macOS**:
    ```bash
    ./host-network.sh
    ```

This starts both the Astro dev server and blog save API, accessible from any device on your WiFi. For a more secure setup, see `https-setup.md`.

## What It Does

The hosting scripts (`host-network.sh` for Linux/macOS, `host-network-https.ps1` for Windows):
1. Detect your local network IP address
2. Starts the blog save API server (port 4322)
3. Starts Astro dev server with network binding (port 4321)
4. Displays URLs for accessing from other devices

## Accessing Your Blog

After running the script, you'll see output like:
```
📱 Access from any device on your network:
   🌐 http://192.168.1.100:4321
```

From any device on your WiFi:
- Browse to the displayed IP address
- Edit posts in `/notepad`
- All changes save back to your Minisforum PC

## Features Available Over Network

✅ **Full blog browsing** - All pages and posts
✅ **Notepad editor** - Create/edit/delete posts
✅ **Image support** - Paste and position images
✅ **Live preview** - See changes instantly
✅ **Auto-save queue** - Changes persist across refreshes

## Security Considerations

⚠️ **Local Network Only**
- Only devices on your WiFi can access the blog
- Do NOT use on public/unsecured networks
- Consider your router's guest network isolation

🔒 **No Authentication**
- Anyone on your network can edit posts
- Password-protected posts still require passwords to view
- But editing is unrestricted

## Firewall Configuration

If other devices can't connect, check your firewall:

### Linux (ufw)
```bash
sudo ufw allow 4321/tcp
sudo ufw allow 4322/tcp
```

### Windows
- Windows Firewall should prompt on first run
- Allow Node.js when asked

### macOS
- Usually works without configuration
- Check System Preferences > Security & Privacy > Firewall

## Auto-Start on Boot (Linux/Systemd)

To run automatically when your Minisforum starts:

1. Create service file:
```bash
sudo nano /etc/systemd/system/ely-blog.service
```

2. Add this content:
```ini
[Unit]
Description=ely0030's Blog Server
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/path/to/ely0030.github.io
ExecStart=/path/to/ely0030.github.io/host-network.sh
Restart=always
Environment="PATH=/usr/bin:/usr/local/bin"
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
```

3. Enable and start:
```bash
sudo systemctl enable ely-blog.service
sudo systemctl start ely-blog.service
```

## Troubleshooting

### Can't access from other devices?
1. Check IP address is correct: `hostname -I` (Linux) or `ipconfig getifaddr en0` (macOS)
2. Verify both servers started (check terminal output)
3. Test firewall by temporarily disabling it
4. Ensure devices are on same network/subnet

### Save functionality not working?
1. Check browser console for errors
2. Verify API server is running (port 4322)
3. CORS errors? The server auto-configures for network IPs

### Performance issues?
- The dev server rebuilds on every change
- For better performance, use `npm run build` + static server
- But you'll lose hot reload and edit capabilities

## Alternative: Production Build

For read-only access with better performance:
```bash
npm run build
npx serve -l tcp://0.0.0.0:3000 dist/
```

But this disables:
- Notepad editing
- Hot reload
- Save functionality

## Mobile Considerations

When accessing from phones/tablets:
- The UI is responsive and touch-friendly
- Image paste may not work (use file upload)
- Save large edits frequently (mobile browsers can reload)
- Consider bookmarking the notepad URL

## Network Architecture

```
Your WiFi Network
├── Minisforum PC (Host)
│   ├── Astro Dev Server (:4321)
│   └── Blog Save API (:4322)
└── Client Devices
    ├── Phone
    ├── Tablet
    └── Laptop
```

All devices connect to the Minisforum's IP address to access the blog.