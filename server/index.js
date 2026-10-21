import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './database.js';
import { createApi } from './api.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const production = process.argv.includes('--production');
const port = Number(process.env.PORT || 5173);
const db = openDatabase(process.env.DATABASE_PATH || resolve(root, 'var/inventory.sqlite'));
const api = createApi(db);
let vite;
if (!production) {
  const { createServer } = await import('vite');
  vite = await createServer({ root, server: { middlewareMode: true, fs: { deny: ['**/var/**', '**/server/**', '**/.env*', '**/.git/**', '**/*.{sqlite,sqlite-wal,sqlite-shm,db,pem,crt}'] } }, appType: 'spa' });
}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  // Bind to loopback and reject unexpected Host values (including DNS rebinding).
  if (!['127.0.0.1', 'localhost', '[::1]'].some(host => req.headers.host === `${host}:${port}`)) { res.writeHead(403); res.end('Local access only.'); return; }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  let decodedPath;
  try { decodedPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); res.end(); return; }
  if (/(^|\/)(var|server|\.git|\.env[^/]*)(\/|$)/.test(decodedPath) || /\.(sqlite(?:-wal|-shm)?|db|pem|crt)$/i.test(decodedPath)) { res.writeHead(404); res.end(); return; }
  if (await api(req, res)) return;
  if (vite) { vite.middlewares(req, res); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  const dist = resolve(root, 'dist');
  let path;
  try { path = resolve(dist, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)); }
  catch { res.writeHead(400); res.end(); return; }
  if (!path.startsWith(dist + sep) && path !== dist) { res.writeHead(403); res.end(); return; }
  try {
    if (!(await stat(path).catch(() => null))?.isFile()) {
      if (extname(path)) { res.writeHead(404); res.end(); return; }
      path = resolve(dist, 'index.html');
    }
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': path.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(503); res.end('Build the app first with npm run build.'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Everyday carry: http://127.0.0.1:${port}/\nAdmin: http://127.0.0.1:${port}/admin`));
async function close() { server.close(); await vite?.close(); db.close(); process.exit(0); }
process.on('SIGINT', close); process.on('SIGTERM', close);
