require('dotenv').config();

const https = require("https");
const http = require("http");
const net = require("net");
const fs = require("fs");
const url = require("url");
const crypto = require("crypto");

// SSL certificate options
const options = {
  key: fs.readFileSync("certs/key.pem"),
  cert: fs.readFileSync("certs/cert.pem")
};

// Port configuration
const LISTEN_PORT = parseInt(process.env.LISTEN_PORT || "4320", 10);
const API_PORT = parseInt(process.env.API_PORT || "4322", 10);
const ASTRO_PORT = parseInt(process.env.ASTRO_PORT || "4321", 10);

// Auth configuration - reuse the same secret as the API server
const JWT_SECRET = process.env.BLOG_AUTH_PASSWORD || 'secure-blog-password-2025';

// Paths that don't require authentication
const PUBLIC_PATHS = [
  '/api/login',
  '/favicon.ico'
];

// Check if a path should be public
function isPublicPath(pathname) {
  return PUBLIC_PATHS.some(path => pathname === path || pathname.startsWith(path));
}

// Parse cookies from request
function parseCookies(cookieHeader) {
  const cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const parts = cookie.trim().split('=');
      if (parts.length === 2) {
        cookies[parts[0]] = parts[1];
      }
    });
  }
  return cookies;
}

// Verify auth token (simple hash check like the API server)
function verifyAuthToken(token) {
  if (!token) return false;
  
  try {
    // The API server creates tokens as SHA256 hash of the password
    const expectedToken = crypto
      .createHash('sha256')
      .update(JWT_SECRET)
      .digest('hex');
    
    console.log(`[${new Date().toISOString()}] Token verification:`, {
      received: token,
      expected: expectedToken,
      match: token === expectedToken
    });
    
    return token === expectedToken;
  } catch (err) {
    console.error('Token verification error:', err);
    return false;
  }
}

// Login page HTML
const loginPageHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login Required</title>
  <style>
    body {
      font-family: monospace;
      margin: 0;
      padding: 0;
      background: #fdfdfd;
      color: #000;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
      padding-top: 40vh;
    }
    .login-container {
      text-align: center;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: center;
    }
    input {
      width: 200px;
      padding: 4px 6px;
      border: 1px solid #ccc;
      background: #fff;
      color: #000;
      font-family: monospace;
      font-size: 14px;
    }
    input:focus {
      outline: none;
      border-color: #0055bb;
    }
    button {
      background: none;
      border: none;
      color: #0055bb;
      font-family: monospace;
      font-size: 14px;
      text-decoration: underline;
      cursor: pointer;
      padding: 0;
      margin: 0;
    }
    button:hover {
      text-decoration: none;
    }
    button:disabled {
      color: #ccc;
      cursor: not-allowed;
      text-decoration: none;
    }
    .error {
      color: #d32f2f;
      margin-top: 10px;
      font-size: 13px;
      font-family: monospace;
      min-height: 18px;
    }
  </style>
</head>
<body>
  <div class="login-container">
    <form id="loginForm">
      <input 
        type="password" 
        id="password" 
        name="password" 
        required 
        autofocus
      >
      <button type="submit" id="submitBtn">login</button>
      <div class="error" id="error"></div>
    </form>
  </div>

  <script>
    const form = document.getElementById('loginForm');
    const passwordInput = document.getElementById('password');
    const submitBtn = document.getElementById('submitBtn');
    const errorDiv = document.getElementById('error');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const password = passwordInput.value;
      if (!password) {
        errorDiv.textContent = 'please enter a password';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'logging in...';
      errorDiv.textContent = '';

      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ password })
        });

        const data = await response.json();

        if (response.ok && data.token) {
          // Success! The cookie is set by the server, just reload
          window.location.reload();
        } else {
          errorDiv.textContent = data.error || 'invalid password';
          passwordInput.select();
          submitBtn.disabled = false;
          submitBtn.textContent = 'login';
        }
      } catch (err) {
        console.error('Login error:', err);
        errorDiv.textContent = 'connection error. please try again.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Query';
      }
    });

    // Allow Enter key to submit
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        form.dispatchEvent(new Event('submit'));
      }
    });
  </script>
</body>
</html>
`;

// Create HTTPS server with auth protection
const server = https.createServer(options, (req, res) => {
  const startTime = Date.now();
  const parsedUrl = url.parse(req.url);
  const pathname = parsedUrl.pathname;
  
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Check if this is a public path
  if (!isPublicPath(pathname)) {
    // Parse cookies and check auth
    const cookies = parseCookies(req.headers.cookie);
    const authToken = cookies.blog_auth;
    
    // Debug logging
    console.log(`[${new Date().toISOString()}] Cookie header:`, req.headers.cookie);
    console.log(`[${new Date().toISOString()}] Parsed cookies:`, cookies);
    console.log(`[${new Date().toISOString()}] Auth token:`, authToken);
    
    if (!verifyAuthToken(authToken)) {
      // No valid auth - show login page
      console.log(`[${new Date().toISOString()}] Unauthorized access attempt to ${pathname}`);
      res.statusCode = 200; // Use 200 so the login page loads properly
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(loginPageHTML);
      return;
    }
  }
  
  // User is authenticated or accessing public path - proxy the request
  const targetPort = pathname.startsWith("/api") ? API_PORT : ASTRO_PORT;
  const targetName = pathname.startsWith("/api") ? "API" : "Astro";
  
  // Copy headers and remove problematic ones
  const proxyHeaders = { ...req.headers };
  proxyHeaders.host = `127.0.0.1:${targetPort}`;
  delete proxyHeaders['accept-encoding'];
  proxyHeaders.connection = 'close';
  
  // Prepare proxy options
  const proxyOptions = {
    hostname: "127.0.0.1",
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: proxyHeaders
  };
  
  // Make the proxy request
  const proxyReq = http.request(proxyOptions, (proxyRes) => {
    console.log(`[${new Date().toISOString()}] Response from ${targetName}: ${proxyRes.statusCode} (${Date.now() - startTime}ms)`);
    
    // Copy status and headers
    res.statusCode = proxyRes.statusCode;
    Object.keys(proxyRes.headers).forEach(key => {
      res.setHeader(key, proxyRes.headers[key]);
    });
    
    // Special handling for login endpoint - set cookie on proxy's domain
    if (pathname === '/api/login' && proxyRes.statusCode === 200) {
      // Read the response to get the token
      let body = '';
      proxyRes.on('data', chunk => {
        body += chunk;
      });
      proxyRes.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.success && data.token) {
            // Set cookie for the proxy's domain
            const cookieValue = `blog_auth=${data.token}; HttpOnly; Secure; Path=/; Max-Age=${24*60*60}; SameSite=Lax`;
            res.setHeader('Set-Cookie', cookieValue);
            console.log(`[${new Date().toISOString()}] Login successful, cookie set`);
            console.log(`[${new Date().toISOString()}] Cookie value:`, cookieValue);
          }
        } catch (err) {
          console.error('Error parsing login response:', err);
        }
        res.end(body);
      });
    } else {
      // Normal response - just pipe it
      proxyRes.pipe(res);
    }
  });
  
  // Handle proxy errors
  proxyReq.on("error", (err) => {
    console.error(`[${new Date().toISOString()}] Proxy error for ${req.url}: ${err.message}`);
    
    if (!res.headersSent) {
      if (err.code === "ECONNREFUSED") {
        res.statusCode = 502;
        res.setHeader("Content-Type", "text/html");
        res.end(`
          <!DOCTYPE html>
          <html>
          <head><title>502 Bad Gateway</title></head>
          <body>
            <h1>502 Bad Gateway</h1>
            <p>Cannot connect to ${targetName} server on port ${targetPort}</p>
            <p>Error: ${err.message}</p>
          </body>
          </html>
        `);
      } else {
        res.statusCode = 500;
        res.setHeader("Content-Type", "text/plain");
        res.end(`Proxy Error: ${err.message}`);
      }
    }
  });
  
  // Handle timeouts
  proxyReq.setTimeout(30000, () => {
    console.error(`[${new Date().toISOString()}] Request timeout for ${req.url}`);
    proxyReq.destroy();
    if (!res.headersSent) {
      res.statusCode = 504;
      res.end("Gateway Timeout");
    }
  });
  
  // Pipe request body if present
  if (req.method !== "GET" && req.method !== "HEAD") {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
  
});

// Proxy WebSocket upgrades (for Vite HMR etc.)
server.on('upgrade', (req, socket, head) => {
  try {
    const parsedUrl = url.parse(req.url);
    const pathname = parsedUrl.pathname || '/';

    // Enforce auth for upgrade requests too (same rule set)
    if (!isPublicPath(pathname)) {
      const cookies = parseCookies(req.headers.cookie);
      const authToken = cookies.blog_auth;
      if (!verifyAuthToken(authToken)) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
    }

    // Tunnel the upgrade to the Astro dev server
    const upstream = net.connect(ASTRO_PORT, '127.0.0.1', () => {
      // Recreate the original HTTP upgrade request for the upstream server
      const headers = { ...req.headers, host: `127.0.0.1:${ASTRO_PORT}` };
      const headerLines = Object.keys(headers)
        .map((k) => `${k}: ${headers[k]}`)
        .join('\r\n');
      const requestLine = `${req.method} ${req.url} HTTP/${req.httpVersion}`;
      upstream.write(requestLine + '\r\n' + headerLines + '\r\n\r\n');
      if (head && head.length) upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });

    upstream.on('error', (err) => {
      console.error('WebSocket upstream error:', err.message);
      try { socket.destroy(); } catch {}
    });
  } catch (e) {
    console.error('Upgrade handling error:', e);
    try { socket.destroy(); } catch {}
  }
});

server.listen(LISTEN_PORT, "0.0.0.0", () => {
  console.log(`
HTTPS PROXY SERVER (PROTECTED MODE)
===================================

🔒 AUTHENTICATION REQUIRED FOR ALL PAGES

Access the site at: https://localhost:${LISTEN_PORT}

This proxies:
  /api/* requests to port ${API_PORT} (secure blog server)
  all other requests to port ${ASTRO_PORT} (Astro)

All requests require authentication except:
  - /api/login (login endpoint)
  - Login page (shown automatically)

HTTPS proxy running on https://0.0.0.0:${LISTEN_PORT}
`);
});
