# 🌐 Network Hosting Guide

Host your blog on your local network for access from any device!

## 🚀 Quick Start

```bash
./host-network.sh
```

That's it! Your blog is now accessible from any device on your WiFi.

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

# Windows/Mac usually work without configuration
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

**Need help?**
- Full guide: `docs/network-hosting-setup.md`
- Check terminal output for specific errors

## 🎯 Perfect For

- Writing from your couch on your phone
- Showing your blog to friends
- Editing from multiple computers
- Having a personal blog server at home

Enjoy your network-accessible blog! 🎉