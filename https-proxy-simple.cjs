const https = require("https");
const httpProxy = require("http-proxy");
const fs = require("fs");

// Create a proxy server with proper error handling
const proxy = httpProxy.createProxyServer({
  secure: false, // Don't verify SSL certs on backend
  changeOrigin: true,
  ws: true, // Enable WebSocket support
  timeout: 30000
});

// Handle proxy errors
proxy.on('error', function(err, req, res) {
  console.error('Proxy error:', err.message);
  if (res && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad Gateway: ' + err.message);
  }
});

// SSL options
const options = {
  key: fs.readFileSync("certs/key.pem"),
  cert: fs.readFileSync("certs/cert.pem")
};

// Port configuration
const LISTEN_PORT = parseInt(process.env.LISTEN_PORT || "4320", 10);
const API_PORT = parseInt(process.env.API_PORT || "4322", 10);
const ASTRO_PORT = parseInt(process.env.ASTRO_PORT || "4321", 10);

// Create HTTPS server
https.createServer(options, function(req, res) {
  // Log the request
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Determine target
  const target = req.url.startsWith("/api") 
    ? `http://127.0.0.1:${API_PORT}`
    : `http://127.0.0.1:${ASTRO_PORT}`;
  
  // Proxy the request
  proxy.web(req, res, { target: target });
}).listen(LISTEN_PORT, "0.0.0.0", () => {
  console.log(`
HTTPS PROXY SERVER (Simple)
===========================

Access the site at: https://localhost:${LISTEN_PORT}

This proxies:
  /api/* requests to port ${API_PORT} (secure blog server)
  all other requests to port ${ASTRO_PORT} (Astro)

HTTPS proxy running on https://0.0.0.0:${LISTEN_PORT}
`);
});