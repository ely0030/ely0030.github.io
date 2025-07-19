# Blueprint: Network Security Hardening

## Overview

Implement network-level security measures including VPN-only access, advanced firewall rules, intrusion detection, and network segmentation. This creates multiple layers of network defense.

## Current Network Exposure

```
Current Setup:
Internet → Router → Minisforum PC (0.0.0.0:4321)
                 ↗ Any device on WiFi can access
```

## Target Architecture

```
Hardened Setup:
Internet → Router → Firewall → VPN Server → Minisforum PC
                              ↘ IDS/IPS → Alerts
```

## Implementation Plan

### 1. VPN-Only Access (Highest Security)

#### WireGuard Setup (Recommended - Fast & Secure)

```bash
# Install WireGuard on Minisforum
sudo apt update
sudo apt install wireguard

# Generate server keys
cd /etc/wireguard
umask 077
wg genkey | tee server_private.key | wg pubkey > server_public.key

# Create server config
cat > /etc/wireguard/wg0.conf << EOF
[Interface]
Address = 10.0.0.1/24
ListenPort = 51820
PrivateKey = $(cat server_private.key)

# NAT for client traffic (optional)
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

# Client configs will be added here
EOF

# Enable IP forwarding
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
sysctl -p
```

#### Client Configuration
```bash
# Generate client keys
wg genkey | tee client_private.key | wg pubkey > client_public.key

# Add to server config
cat >> /etc/wireguard/wg0.conf << EOF

[Peer]
# Phone/Laptop
PublicKey = $(cat client_public.key)
AllowedIPs = 10.0.0.2/32
EOF

# Client config file
cat > client.conf << EOF
[Interface]
Address = 10.0.0.2/32
PrivateKey = CLIENT_PRIVATE_KEY
DNS = 1.1.1.1

[Peer]
PublicKey = SERVER_PUBLIC_KEY
Endpoint = YOUR_PUBLIC_IP:51820
AllowedIPs = 10.0.0.0/24, 192.168.1.0/24
PersistentKeepalive = 25
EOF
```

#### Integrate with Blog
```javascript
// vpn-check-middleware.js
function requireVPN(req, res, next) {
  const clientIP = req.ip;
  const vpnSubnet = '10.0.0.0/24';
  
  if (!isIPInSubnet(clientIP, vpnSubnet)) {
    return res.status(403).json({ 
      error: 'VPN connection required',
      help: 'Please connect to the VPN to access this service'
    });
  }
  
  next();
}

// Apply to all routes
app.use('/api', requireVPN);
app.use('/notepad', requireVPN);
```

### 2. Advanced Firewall Rules

#### UFW (Uncomplicated Firewall) Setup
```bash
# Basic setup
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (change port for security)
sudo ufw allow 22222/tcp comment 'SSH on custom port'

# Allow WireGuard VPN
sudo ufw allow 51820/udp comment 'WireGuard VPN'

# Allow blog ONLY from VPN subnet
sudo ufw allow from 10.0.0.0/24 to any port 4321 comment 'Blog via VPN'
sudo ufw allow from 10.0.0.0/24 to any port 4322 comment 'Blog API via VPN'

# Block blog from local network (force VPN use)
sudo ufw deny from 192.168.0.0/16 to any port 4321
sudo ufw deny from 192.168.0.0/16 to any port 4322

# Enable firewall
sudo ufw enable
```

#### iptables Advanced Rules
```bash
# Rate limiting
iptables -A INPUT -p tcp --dport 4321 -m state --state NEW -m limit --limit 10/min --limit-burst 20 -j ACCEPT
iptables -A INPUT -p tcp --dport 4321 -m state --state NEW -j DROP

# Port knocking sequence (hidden access)
# Must knock ports 7000,8000,9000 in sequence to open 4321
iptables -N KNOCKING
iptables -A INPUT -j KNOCKING

iptables -A KNOCKING -p tcp --dport 7000 -m recent --set --name AUTH1
iptables -A KNOCKING -p tcp --dport 8000 -m recent --rcheck --name AUTH1 --seconds 10 -m recent --set --name AUTH2
iptables -A KNOCKING -p tcp --dport 9000 -m recent --rcheck --name AUTH2 --seconds 10 -m recent --set --name AUTH3
iptables -A KNOCKING -p tcp --dport 4321 -m recent --rcheck --name AUTH3 --seconds 10 -j ACCEPT
```

### 3. Intrusion Detection System (IDS)

#### Fail2Ban Setup
```bash
# Install fail2ban
sudo apt install fail2ban

# Create blog-specific jail
cat > /etc/fail2ban/jail.d/blog.conf << EOF
[blog-auth]
enabled = true
port = 4321,4322
filter = blog-auth
logpath = /var/log/blog/auth.log
maxretry = 3
findtime = 600
bantime = 3600

[blog-dos]
enabled = true
port = 4321,4322
filter = blog-dos
logpath = /var/log/blog/access.log
maxretry = 100
findtime = 60
bantime = 600
EOF

# Create filter rules
cat > /etc/fail2ban/filter.d/blog-auth.conf << EOF
[Definition]
failregex = Failed login from <HOST>
            Unauthorized access attempt from <HOST>
            Invalid token from <HOST>
ignoreregex =
EOF

cat > /etc/fail2ban/filter.d/blog-dos.conf << EOF
[Definition]
failregex = <HOST> - - \[.*\] "(GET|POST) .* HTTP/.*" .*
ignoreregex =
EOF
```

#### AIDE (File Integrity Monitoring)
```bash
# Install AIDE
sudo apt install aide

# Configure for blog monitoring
cat >> /etc/aide/aide.conf << EOF
# Blog content monitoring
/home/user/blog/src/content/blog R+a+sha256
/home/user/blog/blog-save-server.js R+sha256
/home/user/blog/src/pages/notepad.astro R+sha256
EOF

# Initialize database
sudo aideinit
sudo cp /var/lib/aide/aide.db.new /var/lib/aide/aide.db

# Daily check cron
echo "0 3 * * * root /usr/bin/aide --check | mail -s 'AIDE Report' admin@example.com" >> /etc/crontab
```

### 4. Network Segmentation

#### VLAN Setup (Advanced)
```bash
# Create VLAN for blog server
sudo apt install vlan
sudo modprobe 8021q

# Add VLAN interface
sudo ip link add link eth0 name eth0.100 type vlan id 100
sudo ip addr add 192.168.100.10/24 dev eth0.100
sudo ip link set up eth0.100

# Persistent configuration
cat >> /etc/network/interfaces << EOF
auto eth0.100
iface eth0.100 inet static
    address 192.168.100.10
    netmask 255.255.255.0
    vlan-raw-device eth0
EOF
```

#### Docker Network Isolation
```yaml
# docker-compose.yml for isolated blog
version: '3.8'

services:
  blog:
    build: .
    networks:
      - blog_net
    ports:
      - "127.0.0.1:4321:4321"
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
    
  blog-api:
    build: ./api
    networks:
      - blog_net
      - db_net
    security_opt:
      - no-new-privileges:true
      
networks:
  blog_net:
    driver: bridge
    internal: true
  db_net:
    driver: bridge
    internal: true
```

### 5. SSL/TLS Hardening

#### Nginx Reverse Proxy with SSL
```nginx
# /etc/nginx/sites-available/blog
server {
    listen 443 ssl http2;
    server_name blog.local;

    # Strong SSL configuration
    ssl_certificate /etc/letsencrypt/live/blog.local/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/blog.local/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";
    
    # Certificate pinning
    add_header Public-Key-Pins 'pin-sha256="base64+primary=="; max-age=5184000';

    location / {
        proxy_pass http://localhost:4321;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Security headers
        add_header X-Content-Type-Options nosniff;
        add_header X-Frame-Options DENY;
        add_header X-XSS-Protection "1; mode=block";
    }
}
```

### 6. Monitoring & Alerting

#### Security Event Logger
```javascript
// security-monitor.js
const EventEmitter = require('events');
const nodemailer = require('nodemailer');

class SecurityMonitor extends EventEmitter {
  constructor() {
    super();
    this.setupAlerts();
  }

  setupAlerts() {
    // Email alerts for critical events
    this.on('critical', async (event) => {
      await this.sendAlert('CRITICAL Security Event', event);
    });

    // Log all events
    this.on('*', (event) => {
      this.logEvent(event);
    });
  }

  detectBruteForce(ip, attempts) {
    if (attempts > 5) {
      this.emit('critical', {
        type: 'brute_force',
        ip: ip,
        attempts: attempts,
        timestamp: new Date()
      });
    }
  }

  detectAnomalousAccess(ip, time) {
    const hour = new Date(time).getHours();
    
    // Alert on unusual hours (2 AM - 6 AM)
    if (hour >= 2 && hour <= 6) {
      this.emit('warning', {
        type: 'unusual_time',
        ip: ip,
        time: time
      });
    }
  }

  detectPortScan(ip, ports) {
    if (ports.length > 10) {
      this.emit('critical', {
        type: 'port_scan',
        ip: ip,
        ports: ports,
        timestamp: new Date()
      });
      
      // Auto-block IP
      this.blockIP(ip);
    }
  }

  async blockIP(ip) {
    // Add to firewall block list
    exec(`sudo ufw insert 1 deny from ${ip}`, (error) => {
      if (!error) {
        this.emit('info', {
          type: 'ip_blocked',
          ip: ip
        });
      }
    });
  }
}
```

### 7. Hardened Network Configuration

#### sysctl Security Settings
```bash
# /etc/sysctl.d/99-security.conf

# IP Spoofing protection
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# Ignore ICMP redirects
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0

# Ignore send redirects
net.ipv4.conf.all.send_redirects = 0

# Disable source packet routing
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0

# Log Martians
net.ipv4.conf.all.log_martians = 1

# Ignore ICMP ping requests
net.ipv4.icmp_echo_ignore_all = 1

# Ignore Directed pings
net.ipv4.icmp_echo_ignore_broadcasts = 1

# TCP SYN flood protection
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 2048
net.ipv4.tcp_synack_retries = 2
net.ipv4.tcp_syn_retries = 5

# Apply settings
sudo sysctl -p /etc/sysctl.d/99-security.conf
```

### 8. Zero-Trust Network Access

```javascript
// zero-trust-middleware.js
class ZeroTrustGateway {
  async validateAccess(req) {
    const checks = [
      this.checkDeviceTrust(req),
      this.checkUserIdentity(req),
      this.checkNetworkLocation(req),
      this.checkTimeWindow(req),
      this.checkBehavior(req)
    ];

    const results = await Promise.all(checks);
    const trustScore = results.reduce((acc, val) => acc + val, 0) / checks.length;

    if (trustScore < 0.8) {
      throw new Error('Insufficient trust score');
    }

    return trustScore;
  }

  async checkDeviceTrust(req) {
    // Check device certificate
    const cert = req.connection.getPeerCertificate();
    
    if (!cert || !this.isValidDeviceCert(cert)) {
      return 0;
    }

    // Check device health
    const deviceHealth = await this.getDeviceHealth(cert.fingerprint);
    
    return deviceHealth.score;
  }

  async checkNetworkLocation(req) {
    const ip = req.ip;
    
    // Check if from expected network
    if (this.isVPNIP(ip)) return 1.0;
    if (this.isHomeNetwork(ip)) return 0.7;
    if (this.isKnownNetwork(ip)) return 0.5;
    
    return 0;
  }
}
```

## Implementation Priority

1. **Quick Wins (1-2 hours)**
   - Enable UFW with basic rules
   - Install fail2ban
   - Apply sysctl hardening

2. **Medium Effort (1 day)**
   - Set up WireGuard VPN
   - Configure Nginx reverse proxy
   - Implement IDS monitoring

3. **Advanced (1 week)**
   - Network segmentation
   - Zero-trust architecture
   - Full security monitoring

## Testing Network Security

```bash
# Port scanning test
nmap -sV -sC -O -A YOUR_IP

# Vulnerability scanning
nikto -h https://YOUR_IP:4321

# SSL/TLS testing
testssl.sh https://YOUR_IP:4321

# Firewall testing
sudo nmap -sA YOUR_IP

# DDoS simulation (careful!)
ab -n 10000 -c 100 https://YOUR_IP:4321/
```

## Maintenance

- Weekly firewall rule review
- Monthly VPN certificate rotation
- Daily IDS log review
- Quarterly penetration testing
- Annual security audit

## Next Steps

- Implement private thoughts mode for maximum security
- Set up honeypot for attacker detection
- Add blockchain-based audit logs
- Consider hardware security module