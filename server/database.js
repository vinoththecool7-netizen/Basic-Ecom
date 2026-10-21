import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { products } from '../src/data.js';

const descriptions = {
  Tech: 'Thoughtfully chosen technology for your everyday routine. Simple to use, easy to carry, and made to keep up with wherever the day takes you.',
  Bags: 'A place for everything you carry. Practical compartments, a comfortable fit, and a considered silhouette that moves easily from your daily commute to a weekend away.',
  Apparel: 'An everyday essential with a comfortable fit and a clean, versatile look. Made for the familiar routes and the unexpected turns along the way.',
  Outdoor: 'For the moments outside. A practical, easy-to-pack essential for your daily adventures, from the morning walk to your next escape.',
};

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  if (path !== ':memory:') chmodSync(path, 0o600);
  if (!db.prepare('SELECT count(*) count FROM products').get().count) {
    const quantities = [24, 38, 8, 45, 17, 0, 64, 6, 0, 12, 4, 31];
    transaction(db, () => {
      const insert = db.prepare(`INSERT INTO products (id, sku, name, description, category, colour, price_cents, quantity, image, rating, reviews, added, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      const movement = db.prepare('INSERT INTO stock_movements (product_id, delta, quantity_after, reason) VALUES (?, ?, ?, ?)');
      products.forEach((p, i) => {
        insert.run(p.id, `EC-${String(i + 1).padStart(4, '0')}`, p.name, descriptions[p.category], p.category, p.colour, Math.round(p.price * 100), quantities[i], p.image, p.rating, p.reviews, p.added, i);
        movement.run(p.id, quantities[i], quantities[i], 'Opening stock (sample catalog)');
      });
    });
  }
  return db;
}

export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = fn(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function publicProduct(row) {
  return { id: row.id, name: row.name, description: row.description, category: row.category, colour: row.colour, price: row.price_cents / 100, rating: row.rating, reviews: row.reviews, inStock: row.quantity > 0, available: row.quantity, added: row.added, image: row.image };
}
export function adminProduct(row) {
  return { ...publicProduct(row), sku: row.sku, quantity: row.quantity, lowStockThreshold: row.low_stock_threshold, archived: Boolean(row.archived), revision: row.revision, updatedAt: row.updated_at };
}
