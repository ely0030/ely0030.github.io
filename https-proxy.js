const https = require("https");
const http = require("http");
const fs = require("fs");

const options = {
  key: fs.readFileSync("certs/key.pem"),
  cert: fs.readFileSync("certs/cert.pem")
};

https.createServer(options, (req, res) => {
  const targetPort = req.url.startsWith("/api") ? 4322 : 4320;
  
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
}).listen(4321, "0.0.0.0", () => {
  console.log("HTTPS proxy running on https://0.0.0.0:4321");
}); 