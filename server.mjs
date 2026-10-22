import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 5178);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.ttf':'font/ttf','.json':'application/json'};
const server = http.createServer((req,res) => {
  if(req.url === '/__health') { res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({app:'shanshui-qinghui',version:'1.0.0'})); return; }
  let requested;
  try { requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }
  const file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.stat(file,(error,stat) => {
    if(error || !stat.isFile()) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200,{'Content-Type': types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-cache'});
    fs.createReadStream(file).pipe(res);
  });
});
server.on('error', e => {
  if(e.code === 'EADDRINUSE') { console.log(`Already running: http://localhost:${port}`); process.exit(0); }
  else { console.error(e); process.exit(1); }
});
server.listen(port, 'localhost', () => console.log(`Shanshui Qinghui http://localhost:${port}\nKeep this window open. Ctrl+C to stop.`));
