const https = require("https");
const http = require("http");
const fs = require("fs");

const options = {
  key: fs.readFileSync("certs/key.pem"),
  cert: fs.readFileSync("certs/cert.pem")
};

// Allow port overrides via environment variables so this one file can be
// reused by both normal and DEBUG launch scripts (which swap 4320/4321).
const LISTEN_PORT = parseInt(process.env.LISTEN_PORT || "4321", 10);
const API_PORT    = parseInt(process.env.API_PORT    || "4322", 10);
const ASTRO_PORT  = parseInt(process.env.ASTRO_PORT  || "4320", 10);

https.createServer(options, (req, res) => {
  // Decide target port based on path
  const targetPort = req.url.startsWith("/api") ? API_PORT : ASTRO_PORT;

  const proxy = http.request({
    hostname: "127.0.0.1",
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: req.headers
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  req.pipe(proxy);
}).listen(LISTEN_PORT, "0.0.0.0", () => {
  console.log(`HTTPS proxy running on https://0.0.0.0:${LISTEN_PORT}`);
}); 