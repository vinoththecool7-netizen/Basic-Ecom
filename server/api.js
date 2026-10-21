import { randomBytes, randomUUID, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { categories, colours } from '../src/data.js';
import { adminProduct, publicProduct, transaction } from './database.js';

const derive = promisify(scrypt);
const hash = value => createHash('sha256').update(value).digest('hex');
const SESSION_SECONDS = 8 * 60 * 60;
const imageNames = ['atlas-headphones', 'carryall-pack', 'meridian-watch', 'volt-runners', 'horizon-sunglasses', 'pioneer-camera', 'hydra-bottle', 'field-cap'];
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const text = (value, label, max = 160, min = 1) => {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) fail(400, `${label} must be ${min}–${max} characters.`);
  return value.trim();
};
const integer = (value, label, min = 0, max = 1000000) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(400, `${label} must be a whole number from ${min} to ${max}.`);
  return value;
};
const emailAddress = value => {
  const email = text(value, 'Email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Enter a valid email address.');
  return email;
};

async function readBody(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) fail(415, 'Send JSON data.');
  let raw = ''; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 32768) fail(413, 'Request is too large.'); raw += chunk; }
  try { const data = JSON.parse(raw); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(); return data; }
  catch { fail(400, 'Invalid JSON data.'); }
}
function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' });
  res.end(JSON.stringify(data));
}
function sessionHash(req) {
  const token = req.headers.cookie?.split(';').map(item => item.trim()).find(item => item.startsWith('ec_session='))?.slice(11);
  return token ? hash(token) : '';
}
function setCookie(res, token, age) {
  res.setHeader('Set-Cookie', `ec_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}`);
}
function credentials(body) {
  const email = emailAddress(body.email);
  if (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128) fail(400, 'Use a password with 12–128 characters.');
  return { email, password: body.password };
}
async function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await derive(password, salt, 64)).toString('hex')}`;
}
async function verifyPassword(password, stored) {
  const [salt, expected] = stored.split(':');
  const actual = await derive(password, salt, 64);
  return timingSafeEqual(Buffer.from(expected, 'hex'), actual);
}
function validateProduct(body) {
  const name = text(body.name, 'Product name');
  const sku = text(body.sku, 'SKU', 40).toUpperCase();
  if (!/^[A-Z0-9_-]+$/.test(sku)) fail(400, 'SKU can contain letters, numbers, hyphens and underscores.');
  if (!categories.includes(body.category)) fail(400, 'Choose a valid category.');
  if (!colours.some(c => c.name === body.colour)) fail(400, 'Choose a valid colour.');
  if (typeof body.price !== 'number' || !Number.isFinite(body.price) || body.price < .01 || body.price > 100000 || Math.abs(body.price * 100 - Math.round(body.price * 100)) > 0.00001) fail(400, 'Enter a price from $0.01 to $100,000 with up to two decimals.');
  if (!imageNames.some(name => body.image === `/images/${name}.jpg`)) fail(400, 'Choose a catalog image.');
  return { name, sku, description: text(body.description ?? '', 'Description', 2000, 0), category: body.category, colour: body.colour, priceCents: Math.round(body.price * 100), quantity: integer(body.quantity, 'Stock quantity'), threshold: integer(body.lowStockThreshold, 'Low stock threshold'), image: body.image };
}
function orderResult(db, row) {
  return { id: row.id, number: row.number, name: row.customer_name, email: row.email, status: row.status, subtotal: row.subtotal_cents / 100, shipping: row.shipping_cents / 100, total: row.total_cents / 100, paymentMethod: row.payment_method, createdAt: row.created_at, items: db.prepare('SELECT name, colour, image, unit_price_cents, quantity FROM order_items WHERE order_id = ?').all(row.id).map(item => ({ name: item.name, colour: item.colour, image: item.image, price: item.unit_price_cents / 100, quantity: item.quantity })) };
}

export function createApi(db) {
  // Also used for unknown accounts so password checks have the same cost.
  const dummyHash = passwordHash(randomBytes(32).toString('hex'));
  const orderAttempts = new Map();
  function currentAdmin(req) {
    return db.prepare('SELECT admins.id, admins.name, admins.email FROM sessions JOIN admins ON admins.id = sessions.admin_id WHERE token_hash = ? AND expires_at > ?').get(sessionHash(req), Date.now());
  }
  function startSession(res, admin) {
    const token = randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    db.prepare('INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (?, ?, ?)').run(hash(token), admin.id, Date.now() + SESSION_SECONDS * 1000);
    setCookie(res, token, SESSION_SECONDS);
    return { id: admin.id, name: admin.name, email: admin.email };
  }
  return async function api(req, res) {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (!path.startsWith('/api/')) return false;
    try {
      if (!['GET', 'HEAD'].includes(req.method)) {
        const origin = req.headers.origin;
        if (origin && origin !== `http://${req.headers.host}`) fail(403, 'Request origin is not allowed.');
        if (req.headers['sec-fetch-site'] === 'cross-site') fail(403, 'Cross-site requests are not allowed.');
      }
      if (path === '/api/products' && req.method === 'GET') {
        json(res, 200, { products: db.prepare('SELECT * FROM products WHERE archived = 0 ORDER BY position, added DESC').all().map(publicProduct) }); return true;
      }
      if (path === '/api/admin/session' && req.method === 'GET') {
        json(res, 200, { admin: currentAdmin(req) ?? null, setupRequired: !db.prepare('SELECT 1 FROM admins LIMIT 1').get() }); return true;
      }
      if (path === '/api/admin/setup' && req.method === 'POST') {
        if (db.prepare('SELECT 1 FROM admins LIMIT 1').get()) fail(403, 'An admin account already exists. Sign in instead.');
        const body = await readBody(req); const { email, password } = credentials(body);
        const name = text(body.name, 'Name', 80); const stored = await passwordHash(password);
        const admin = { id: randomUUID(), name, email };
        transaction(db, () => {
          if (db.prepare('SELECT 1 FROM admins LIMIT 1').get()) fail(403, 'An admin account already exists. Sign in instead.');
          db.prepare('INSERT INTO admins (id, name, email, password_hash) VALUES (?, ?, ?, ?)').run(admin.id, name, email, stored);
        });
        json(res, 201, { admin: startSession(res, admin) }); return true;
      }
      if (path === '/api/admin/login' && req.method === 'POST') {
        const { email, password } = credentials(await readBody(req));
        const ip = req.socket.remoteAddress || 'local'; const cutoff = Date.now() - 15 * 60 * 1000;
        db.prepare('DELETE FROM login_attempts WHERE attempted_at < ?').run(cutoff);
        const attempts = db.prepare('SELECT count(*) count FROM login_attempts WHERE email = ? OR ip = ?').get(email, ip).count;
        if (attempts >= 10) fail(429, 'Too many sign-in attempts. Try again in 15 minutes.');
        db.prepare('INSERT INTO login_attempts (email, ip, attempted_at) VALUES (?, ?, ?)').run(email, ip, Date.now());
        const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email);
        const valid = await verifyPassword(password, admin?.password_hash ?? await dummyHash);
        if (!admin || !valid) fail(401, 'Email or password is incorrect.');
        db.prepare('DELETE FROM login_attempts WHERE email = ?').run(email);
        json(res, 200, { admin: startSession(res, admin) }); return true;
      }
      if (path === '/api/admin/logout' && req.method === 'POST') {
        db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sessionHash(req)); setCookie(res, '', 0); json(res, 200, { ok: true }); return true;
      }
      if (path === '/api/orders' && req.method === 'POST') {
        const body = await readBody(req);
        const key = text(req.headers['idempotency-key'], 'Checkout key', 80, 16);
        const customer = { name: text(body.name, 'Full name', 100), email: emailAddress(body.email), address: text(body.address, 'Street address', 200), city: text(body.city, 'City', 100), postalCode: text(body.postalCode, 'Postal code', 20), country: text(body.country, 'Country', 80) };
        if (!Array.isArray(body.items) || !body.items.length || body.items.length > 50) fail(400, 'Your cart must contain 1–50 products.');
        const items = body.items.map(item => ({ id: text(item.id, 'Product', 100), quantity: integer(item.quantity, 'Quantity', 1, 99) })).sort((a, b) => a.id.localeCompare(b.id));
        if (new Set(items.map(item => item.id)).size !== items.length) fail(400, 'Combine duplicate cart items.');
        const requestHash = hash(JSON.stringify({ customer, items }));
        const previous = db.prepare('SELECT * FROM orders WHERE idempotency_key = ?').get(key);
        if (previous) {
          if (previous.request_hash !== requestHash) fail(409, 'This checkout key has already been used. Please start a new checkout.');
          json(res, 200, { order: orderResult(db, previous) }); return true;
        }
        const ip = req.socket.remoteAddress || 'local'; const now = Date.now();
        for (const [address, entry] of orderAttempts) if (entry.start < now - 900000) orderAttempts.delete(address);
        const rate = orderAttempts.get(ip) ?? { start: now, count: 0 };
        if (rate.count >= 20) fail(429, 'Too many checkouts. Please try again in 15 minutes.');
        rate.count++; orderAttempts.set(ip, rate);
        const order = transaction(db, () => {
          const cart = items.map(item => {
            const product = db.prepare('SELECT * FROM products WHERE id = ? AND archived = 0').get(item.id);
            if (!product) fail(409, 'A product is no longer available. Please review your cart.');
            if (product.quantity < item.quantity) fail(409, `${product.name} has only ${product.quantity} available. Please update your cart.`);
            return { ...item, product };
          });
          const subtotal = cart.reduce((sum, item) => sum + item.product.price_cents * item.quantity, 0);
          const shipping = subtotal >= 20000 ? 0 : 800;
          const id = randomUUID(); const number = `EC-${randomBytes(5).toString('hex').toUpperCase()}`;
          db.prepare(`INSERT INTO orders (id, number, idempotency_key, request_hash, customer_name, email, address, city, postal_code, country, subtotal_cents, shipping_cents, total_cents) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, number, key, requestHash, customer.name, customer.email, customer.address, customer.city, customer.postalCode, customer.country, subtotal, shipping, subtotal + shipping);
          for (const item of cart) {
            const p = item.product;
            db.prepare('INSERT INTO order_items (order_id, product_id, name, sku, colour, image, unit_price_cents, quantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, p.id, p.name, p.sku, p.colour, p.image, p.price_cents, item.quantity);
            db.prepare("UPDATE products SET quantity = quantity - ?, revision = revision + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(item.quantity, p.id);
            db.prepare('INSERT INTO stock_movements (product_id, order_id, delta, quantity_after, reason) VALUES (?, ?, ?, ?, ?)').run(p.id, id, -item.quantity, p.quantity - item.quantity, `Order ${number}`);
          }
          return db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
        });
        json(res, 201, { order: orderResult(db, order) }); return true;
      }
      const admin = currentAdmin(req);
      if (!admin) fail(401, 'Please sign in to continue.');
      if (path === '/api/admin/products' && req.method === 'GET') {
        json(res, 200, { products: db.prepare('SELECT * FROM products ORDER BY position, added DESC').all().map(adminProduct) }); return true;
      }
      if (path === '/api/admin/products' && req.method === 'POST') {
        const p = validateProduct(await readBody(req)); const id = randomUUID();
        transaction(db, () => {
          if (db.prepare('SELECT 1 FROM products WHERE sku = ?').get(p.sku)) fail(409, 'That SKU is already in use.');
          db.prepare('INSERT INTO products (id, sku, name, description, category, colour, price_cents, quantity, low_stock_threshold, image, added, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, p.sku, p.name, p.description, p.category, p.colour, p.priceCents, p.quantity, p.threshold, p.image, new Date().toISOString().slice(0, 10), db.prepare('SELECT coalesce(max(position), 0) + 1 position FROM products').get().position);
          db.prepare('INSERT INTO stock_movements (product_id, admin_id, delta, quantity_after, reason) VALUES (?, ?, ?, ?, ?)').run(id, admin.id, p.quantity, p.quantity, 'Opening stock');
        });
        json(res, 201, { product: adminProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(id)) }); return true;
      }
      const productMatch = path.match(/^\/api\/admin\/products\/([^/]+)$/);
      if (productMatch && req.method === 'PATCH') {
        const body = await readBody(req); const revision = integer(body.revision, 'Revision', 1);
        const p = validateProduct(body);
        if (body.archived !== undefined && typeof body.archived !== 'boolean') fail(400, 'Archived must be true or false.');
        const reason = text(body.reason ?? 'Inventory update', 'Stock adjustment reason', 240);
        transaction(db, () => {
          const current = db.prepare('SELECT * FROM products WHERE id = ?').get(productMatch[1]);
          if (!current) fail(404, 'Product not found.');
          if (current.revision !== revision) fail(409, 'This product changed since you opened it. Close this form, refresh, and try again.');
          if (db.prepare('SELECT 1 FROM products WHERE sku = ? AND id != ?').get(p.sku, current.id)) fail(409, 'That SKU is already in use.');
          db.prepare("UPDATE products SET sku = ?, name = ?, description = ?, category = ?, colour = ?, price_cents = ?, quantity = ?, low_stock_threshold = ?, image = ?, archived = ?, revision = revision + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(p.sku, p.name, p.description, p.category, p.colour, p.priceCents, p.quantity, p.threshold, p.image, Number(body.archived ?? current.archived), current.id);
          if (p.quantity !== current.quantity) db.prepare('INSERT INTO stock_movements (product_id, admin_id, delta, quantity_after, reason) VALUES (?, ?, ?, ?, ?)').run(current.id, admin.id, p.quantity - current.quantity, p.quantity, reason);
        });
        json(res, 200, { product: adminProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(productMatch[1])) }); return true;
      }
      if (path === '/api/admin/movements' && req.method === 'GET') {
        json(res, 200, { movements: db.prepare('SELECT stock_movements.*, products.name product_name, products.sku, admins.name admin_name FROM stock_movements JOIN products ON products.id = stock_movements.product_id LEFT JOIN admins ON admins.id = stock_movements.admin_id ORDER BY stock_movements.id DESC LIMIT 200').all() }); return true;
      }
      if (path === '/api/admin/orders' && req.method === 'GET') {
        json(res, 200, { orders: db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200').all().map(row => ({ ...orderResult(db, row), address: row.address, city: row.city, postalCode: row.postal_code, country: row.country })) }); return true;
      }
      const orderMatch = path.match(/^\/api\/admin\/orders\/([^/]+)$/);
      if (orderMatch && req.method === 'PATCH') {
        const { status } = await readBody(req);
        const transitions = { pending: ['processing', 'cancelled'], processing: ['shipped', 'cancelled'], shipped: ['delivered'], delivered: [], cancelled: [] };
        const order = transaction(db, () => {
          const current = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderMatch[1]);
          if (!current) fail(404, 'Order not found.');
          if (!transitions[current.status].includes(status)) fail(409, 'This order cannot move to that status. Refresh and try again.');
          if (status === 'cancelled') {
            for (const item of db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(current.id)) {
              db.prepare("UPDATE products SET quantity = quantity + ?, revision = revision + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(item.quantity, item.product_id);
              const quantity = db.prepare('SELECT quantity FROM products WHERE id = ?').get(item.product_id).quantity;
              db.prepare('INSERT INTO stock_movements (product_id, admin_id, order_id, delta, quantity_after, reason) VALUES (?, ?, ?, ?, ?, ?)').run(item.product_id, admin.id, current.id, item.quantity, quantity, `Cancelled order ${current.number}`);
            }
          }
          db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, current.id);
          return db.prepare('SELECT * FROM orders WHERE id = ?').get(current.id);
        });
        json(res, 200, { order: orderResult(db, order) }); return true;
      }
      fail(404, 'API endpoint not found.');
    } catch (error) {
      if (!error.status) console.error('API error:', error);
      json(res, error.status || 500, { error: error.status ? error.message : 'Something went wrong. Please try again.' });
    }
    return true;
  };
}
