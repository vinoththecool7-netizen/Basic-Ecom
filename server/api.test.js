import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from './database.js';
import { createApi } from './api.js';

async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'everyday-test-'));
  const db = openDatabase(join(dir, 'test.sqlite'));
  const api = createApi(db);
  const server = createServer(async (req, res) => { if (!await api(req, res)) { res.writeHead(404); res.end(); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); rmSync(dir, { recursive: true, force: true }); });
  let cookie = '';
  async function call(path, method = 'GET', body, headers = {}) {
    const res = await fetch(origin + path, { method, headers: { 'Content-Type': 'application/json', Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (res.headers.get('set-cookie')) cookie = res.headers.get('set-cookie').split(';')[0];
    return { status: res.status, body: await res.json(), headers: res.headers };
  }
  async function setup() { const result = await call('/api/admin/setup', 'POST', { name: 'Test Admin', email: 'admin@example.test', password: 'Only-for-tests-2026!' }); assert.equal(result.status, 201); return result; }
  return { db, call, setup, dir };
}
const buyer = { name: 'Test Customer', email: 'customer@example.test', address: '10 Test Street', city: 'Test City', postalCode: '10001', country: 'United States' };
const key = suffix => `test-checkout-key-${suffix}`;

test('first-run setup, hashed credentials, session protection, login, logout and origin checks', async t => {
  const { db, call, setup } = await fixture(t);
  assert.equal((await call('/api/admin/session')).body.setupRequired, true);
  assert.equal((await call('/api/admin/products')).status, 401);
  assert.equal((await call('/api/admin/setup', 'POST', { name: 'Test', email: 'admin@example.test', password: 'short' })).status, 400);
  const setupResult = await setup();
  assert.match(setupResult.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  const stored = db.prepare('SELECT password_hash FROM admins').get().password_hash;
  assert.ok(!stored.includes('Only-for-tests'));
  assert.match(stored, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
  assert.equal((await call('/api/admin/products')).status, 200);
  assert.equal((await call('/api/admin/setup', 'POST', {})).status, 403);
  assert.equal((await call('/api/admin/logout', 'POST', {}, { Origin: 'https://untrusted.example' })).status, 403);
  assert.equal((await call('/api/admin/logout', 'POST', {})).status, 200);
  assert.equal((await call('/api/admin/products')).status, 401);
  assert.equal((await call('/api/admin/login', 'POST', { email: 'admin@example.test', password: 'Wrong-password-2026!' })).status, 401);
  assert.equal((await call('/api/admin/login', 'POST', { email: 'ADMIN@example.test', password: 'Only-for-tests-2026!' })).status, 200);
  db.prepare('UPDATE sessions SET expires_at = 0').run();
  assert.equal((await call('/api/admin/products')).status, 401);
});

test('inventory validates data, detects stale writes, audits stock, archives and restores', async t => {
  const { db, call, setup } = await fixture(t); await setup();
  const products = (await call('/api/admin/products')).body.products;
  assert.equal(products.length, 12);
  assert.equal((await call('/api/products')).body.products.length, 12);
  const product = products[0];
  const change = { ...product, quantity: 0, reason: 'Physical stock count' };
  const saved = await call(`/api/admin/products/${product.id}`, 'PATCH', change);
  assert.equal(saved.status, 200); assert.equal(saved.body.product.inStock, false);
  assert.equal(saved.body.product.revision, product.revision + 1);
  assert.equal((await call(`/api/admin/products/${product.id}`, 'PATCH', change)).status, 409);
  assert.equal((await call(`/api/admin/products/${product.id}`, 'PATCH', { ...saved.body.product, quantity: -1 })).status, 400);
  assert.equal((await call(`/api/admin/products/${product.id}`, 'PATCH', { ...saved.body.product, price: 1.234 })).status, 400);
  assert.equal((await call(`/api/admin/products/${product.id}`, 'PATCH', { ...saved.body.product, image: 'javascript:alert(1)' })).status, 400);
  const movement = db.prepare('SELECT * FROM stock_movements WHERE product_id = ? ORDER BY id DESC').get(product.id);
  assert.equal(movement.delta, -product.quantity); assert.equal(movement.reason, 'Physical stock count');
  const archived = await call(`/api/admin/products/${product.id}`, 'PATCH', { ...saved.body.product, archived: true });
  assert.equal(archived.status, 200); assert.equal((await call('/api/products')).body.products.length, 11);
  assert.equal((await call(`/api/admin/products/${product.id}`, 'PATCH', { ...archived.body.product, archived: false })).status, 200);
  assert.equal((await call('/api/products')).body.products.length, 12);
  const newProduct = { name: "Traveler's bag", sku: 'EC-NEW', category: 'Bags', colour: 'Black', price: 12.99, quantity: 3, lowStockThreshold: 5, image: '/images/carryall-pack.jpg', description: 'An everyday bag.' };
  assert.equal((await call('/api/admin/products', 'POST', newProduct)).status, 201);
  assert.equal((await call('/api/admin/products', 'POST', newProduct)).status, 409);
  assert.equal(db.prepare('SELECT name FROM products WHERE sku = ?').get('EC-NEW').name, "Traveler's bag");
});

test('checkout uses database prices, deducts stock atomically, and handles retries without duplicate orders', async t => {
  const { db, call } = await fixture(t);
  const result = await call('/api/orders', 'POST', { ...buyer, items: [{ id: 'field-cap', quantity: 2, price: 0.01 }], total: .02 }, { 'Idempotency-Key': key('one') });
  assert.equal(result.status, 201); assert.equal(result.body.order.subtotal, 56); assert.equal(result.body.order.shipping, 8); assert.equal(result.body.order.total, 64);
  assert.equal(db.prepare("SELECT quantity FROM products WHERE id = 'field-cap'").get().quantity, 4);
  const repeat = await call('/api/orders', 'POST', { ...buyer, items: [{ id: 'field-cap', quantity: 2 }] }, { 'Idempotency-Key': key('one') });
  assert.equal(repeat.status, 200); assert.equal(repeat.body.order.id, result.body.order.id);
  assert.equal(db.prepare('SELECT count(*) count FROM orders').get().count, 1);
  assert.equal(db.prepare("SELECT quantity FROM products WHERE id = 'field-cap'").get().quantity, 4);
  assert.equal((await call('/api/orders', 'POST', { ...buyer, items: [{ id: 'field-cap', quantity: 1 }] }, { 'Idempotency-Key': key('one') })).status, 409);
  const freeShipping = await call('/api/orders', 'POST', { ...buyer, items: [{ id: 'atlas-headphones', quantity: 1 }] }, { 'Idempotency-Key': key('two') });
  assert.equal(freeShipping.body.order.shipping, 0); assert.equal(freeShipping.body.order.total, 249);
});

test('failed and concurrent checkouts cannot oversell or partially decrement inventory', async t => {
  const { db, call } = await fixture(t);
  const before = db.prepare("SELECT quantity FROM products WHERE id = 'field-cap'").get().quantity;
  const failed = await call('/api/orders', 'POST', { ...buyer, items: [{ id: 'field-cap', quantity: 1 }, { id: 'pioneer-camera', quantity: 1 }] }, { 'Idempotency-Key': key('failed') });
  assert.equal(failed.status, 409); assert.equal(db.prepare('SELECT count(*) count FROM orders').get().count, 0);
  assert.equal(db.prepare("SELECT quantity FROM products WHERE id = 'field-cap'").get().quantity, before);
  const results = await Promise.all(['a', 'b'].map(suffix => call('/api/orders', 'POST', { ...buyer, items: [{ id: 'field-cap-wool', quantity: 4 }] }, { 'Idempotency-Key': key(suffix) })));
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
  assert.equal(db.prepare("SELECT quantity FROM products WHERE id = 'field-cap-wool'").get().quantity, 0);
  assert.equal(db.prepare('SELECT count(*) count FROM orders').get().count, 1);
  assert.equal((await call('/api/orders', 'POST', { ...buyer, items: [{ id: 'field-cap', quantity: -1 }] }, { 'Idempotency-Key': key('negative') })).status, 400);
  assert.equal((await call('/api/orders', 'POST', { ...buyer, items: [{ id: 'field-cap', quantity: 1 }, { id: 'field-cap', quantity: 1 }] }, { 'Idempotency-Key': key('duplicate') })).status, 400);
});

test('order cancellation restores stock exactly once, and fulfilment follows valid transitions', async t => {
  const { db, call, setup } = await fixture(t); await setup();
  const result = await call('/api/orders', 'POST', { ...buyer, items: [{ id: 'field-cap', quantity: 1 }] }, { 'Idempotency-Key': key('cancel') });
  const order = result.body.order;
  assert.equal((await call(`/api/admin/orders/${order.id}`, 'PATCH', { status: 'delivered' })).status, 409);
  assert.equal((await call(`/api/admin/orders/${order.id}`, 'PATCH', { status: 'processing' })).status, 200);
  assert.equal((await call(`/api/admin/orders/${order.id}`, 'PATCH', { status: 'cancelled' })).status, 200);
  assert.equal(db.prepare("SELECT quantity FROM products WHERE id = 'field-cap'").get().quantity, 6);
  assert.equal((await call(`/api/admin/orders/${order.id}`, 'PATCH', { status: 'cancelled' })).status, 409);
  assert.equal(db.prepare("SELECT quantity FROM products WHERE id = 'field-cap'").get().quantity, 6);
  const active = (await call('/api/orders', 'POST', { ...buyer, items: [{ id: 'field-cap', quantity: 1 }] }, { 'Idempotency-Key': key('ship') })).body.order;
  for (const status of ['processing', 'shipped', 'delivered']) assert.equal((await call(`/api/admin/orders/${active.id}`, 'PATCH', { status })).status, 200);
  assert.equal((await call(`/api/admin/orders/${active.id}`, 'PATCH', { status: 'cancelled' })).status, 409);
  assert.equal((await call('/api/admin/orders')).body.orders.length, 2);
  assert.ok((await call('/api/admin/movements')).body.movements.some(m => m.reason === `Cancelled order ${order.number}`));
});

test('database persists across reopening without resetting stock or creating duplicate products', t => {
  const dir = mkdtempSync(join(tmpdir(), 'everyday-persistence-')); const path = join(dir, 'inventory.sqlite');
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  let db = openDatabase(path);
  db.prepare("UPDATE products SET quantity = 42 WHERE id = 'field-cap'").run(); db.close();
  db = openDatabase(path);
  assert.equal(db.prepare("SELECT quantity FROM products WHERE id = 'field-cap'").get().quantity, 42);
  assert.equal(db.prepare('SELECT count(*) count FROM products').get().count, 12); db.close();
});

test('sign-in rate limiting bounds repeated authentication attempts', async t => {
  const { call, setup } = await fixture(t); await setup(); await call('/api/admin/logout', 'POST', {});
  for (let i = 0; i < 10; i++) assert.equal((await call('/api/admin/login', 'POST', { email: 'admin@example.test', password: 'Wrong-password-2026!' })).status, 401);
  assert.equal((await call('/api/admin/login', 'POST', { email: 'admin@example.test', password: 'Only-for-tests-2026!' })).status, 429);
});
