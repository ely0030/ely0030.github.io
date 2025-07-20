const https = require("https");
const http = require("http");
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

// Verify auth token (simple HMAC check like the API server)
function verifyAuthToken(token) {
  if (!token) return false;
  
  try {
    // The API server creates tokens as HMAC-SHA256 of the password
    const expectedToken = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(JWT_SECRET)
      .digest('hex');
    
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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .login-container {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      width: 100%;
      max-width: 400px;
    }
    h1 {
      margin: 0 0 1.5rem 0;
      color: #333;
      text-align: center;
    }
    .form-group {
      margin-bottom: 1rem;
    }
    label {
      display: block;
      margin-bottom: 0.5rem;
      color: #666;
      font-size: 14px;
    }
    input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 16px;
      box-sizing: border-box;
    }
    input:focus {
      outline: none;
      border-color: #ff8c00;
    }
    button {
      width: 100%;
      padding: 0.75rem;
      background: #ff8c00;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover {
      background: #ff7700;
    }
    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .error {
      color: #d32f2f;
      margin-top: 0.5rem;
      font-size: 14px;
      text-align: center;
      min-height: 20px;
    }
    .info {
      color: #666;
      font-size: 13px;
      text-align: center;
      margin-top: 1rem;
    }
  </style>
</head>
<body>
  <div class="login-container">
    <h1>🔒 Blog Access</h1>
    <form id="loginForm">
      <div class="form-group">
        <label for="password">Password</label>
        <input 
          type="password" 
          id="password" 
          name="password" 
          required 
          autofocus
          placeholder="Enter blog password"
        >
      </div>
      <button type="submit" id="submitBtn">Login</button>
      <div class="error" id="error"></div>
    </form>
    <div class="info">
      This blog is protected. Please enter the password to continue.
    </div>
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
        errorDiv.textContent = 'Please enter a password';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Logging in...';
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
          errorDiv.textContent = data.error || 'Invalid password';
          passwordInput.select();
          submitBtn.disabled = false;
          submitBtn.textContent = 'Login';
        }
      } catch (err) {
        console.error('Login error:', err);
        errorDiv.textContent = 'Connection error. Please try again.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Login';
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
https.createServer(options, (req, res) => {
  const startTime = Date.now();
  const parsedUrl = url.parse(req.url);
  const pathname = parsedUrl.pathname;
  
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Check if this is a public path
  if (!isPublicPath(pathname)) {
    // Parse cookies and check auth
    const cookies = parseCookies(req.headers.cookie);
    const authToken = cookies.blog_auth;
    
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
    
    // Pipe the response
    proxyRes.pipe(res);
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
  
}).listen(LISTEN_PORT, "0.0.0.0", () => {
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