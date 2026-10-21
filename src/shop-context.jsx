import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { request } from './api';

const ShopContext = createContext(null);
export const useShop = () => useContext(ShopContext);
export function ShopProvider({ children }) {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cart, setCart] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ec-cart') || '[]');
      return Array.isArray(saved) ? saved.filter(item => typeof item?.id === 'string' && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 99).slice(0, 50).filter((item, index, all) => all.findIndex(other => other.id === item.id) === index) : [];
    } catch { return []; }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const refresh = useCallback(async () => {
    try { const data = await request('/api/products'); setCatalog(data.products); setError(''); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); const timer = setInterval(refresh, 30000); window.addEventListener('focus', refresh); return () => { clearInterval(timer); window.removeEventListener('focus', refresh); }; }, [refresh]);
  useEffect(() => { try { localStorage.setItem('ec-cart', JSON.stringify(cart)); } catch { /* Cart remains usable if browser storage is full. */ } }, [cart]);
  useEffect(() => {
    const sync = event => {
      if (event.key !== 'ec-cart') return;
      try { const items = JSON.parse(event.newValue || '[]'); if (Array.isArray(items) && items.every(item => typeof item.id === 'string' && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 99)) setCart(items.slice(0, 50)); } catch { /* Ignore malformed storage. */ }
    };
    window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync);
  }, []);
  const lines = useMemo(() => cart.map(item => ({ ...item, product: catalog.find(product => product.id === item.id) })), [cart, catalog]);
  const subtotalCents = lines.reduce((sum, line) => sum + Math.round((line.product?.price || 0) * 100) * line.quantity, 0);
  const subtotal = subtotalCents / 100;
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const invalid = lines.some(line => !line.product || line.quantity > line.product.available);
  function setQuantity(id, quantity) {
    setCart(current => quantity <= 0 ? current.filter(item => item.id !== id) : current.map(item => item.id === id ? { ...item, quantity: Math.min(99, quantity) } : item));
  }
  function addToCart(product, quantity = 1) {
    setCart(current => {
      const existing = current.find(item => item.id === product.id);
      const next = Math.min(99, product.available, (existing?.quantity || 0) + quantity);
      if (next <= 0) return current;
      return existing ? current.map(item => item.id === product.id ? { ...item, quantity: next } : item) : [...current, { id: product.id, quantity: next }];
    });
    setCartOpen(true);
  }
  return <ShopContext.Provider value={{ catalog, loading, error, refresh, cart, lines, subtotal, count, invalid, addToCart, setQuantity, clearCart: () => setCart([]), cartOpen, setCartOpen }}>{children}</ShopContext.Provider>;
}
