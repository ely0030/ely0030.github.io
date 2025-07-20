const https = require("https");
const http = require("http");
const fs = require("fs");
const url = require("url");

// SSL certificate options
const options = {
  key: fs.readFileSync("certs/key.pem"),
  cert: fs.readFileSync("certs/cert.pem")
};

// Port configuration
const LISTEN_PORT = parseInt(process.env.LISTEN_PORT || "4320", 10);
const API_PORT = parseInt(process.env.API_PORT || "4322", 10);
const ASTRO_PORT = parseInt(process.env.ASTRO_PORT || "4321", 10);

// Create HTTPS server
https.createServer(options, (req, res) => {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Determine target port
  const targetPort = req.url.startsWith("/api") ? API_PORT : ASTRO_PORT;
  const targetName = req.url.startsWith("/api") ? "API" : "Astro";
  
  // Parse URL
  const parsedUrl = url.parse(req.url);
  
  // Copy headers and remove problematic ones
  const proxyHeaders = { ...req.headers };
  proxyHeaders.host = `127.0.0.1:${targetPort}`;
  delete proxyHeaders['accept-encoding']; // Properly remove the header
  proxyHeaders.connection = 'close'; // Force close connection
  
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
HTTPS PROXY SERVER
==================

Access the site at: https://localhost:${LISTEN_PORT}

This proxies:
  /api/* requests to port ${API_PORT} (secure blog server)
  all other requests to port ${ASTRO_PORT} (Astro)

HTTPS proxy running on https://0.0.0.0:${LISTEN_PORT}
`);
});