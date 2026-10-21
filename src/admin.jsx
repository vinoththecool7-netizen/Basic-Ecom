import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, ArrowLeft, ArrowRight, Check, ChevronDown, Download, Eye, EyeOff, History, LayoutGrid, LogOut, Package, Pencil, Plus, RefreshCw, Search, ShoppingBag, X } from 'lucide-react';
import { categories, colours, products as seedProducts } from './data';
import { money, request } from './api';
import './admin.css';

const date = value => new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const stockState = p => p.archived ? 'Archived' : p.quantity === 0 ? 'Out of stock' : p.quantity <= p.lowStockThreshold ? 'Low stock' : 'In stock';
function Status({ value }) { return <span className={`inventory-status status-${value.toLowerCase().replaceAll(' ', '-')}`}><span />{value}</span>; }

function Modal({ title, description, children, onClose, wide = false }) {
  const ref = useRef(null);
  useEffect(() => { ref.current.showModal(); const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = previous; }; }, []);
  return <dialog className={`admin-modal ${wide ? 'wide' : ''}`} ref={ref} aria-labelledby="modal-title" onClose={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}><div className="admin-modal-inner"><header><div><h2 id="modal-title">{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" type="button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></header>{children}</div></dialog>;
}

function AdminAuth({ setupRequired, onAuthenticated, reloadSession }) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try { const result = await request(`/api/admin/${setupRequired ? 'setup' : 'login'}`, { method: 'POST', body: JSON.stringify(body) }); onAuthenticated(result.admin); }
    catch (err) { setError(err.message); if (err.status === 403) reloadSession(); }
    finally { setBusy(false); }
  }
  return <main className="admin-auth"><div className="auth-main"><a className="wordmark" href="/">everyday<span>®</span></a><div className="auth-form-wrap enter"><span className="eyebrow">Store administration</span><h1>{setupRequired ? 'A good place to start.' : 'Welcome back.'}</h1><p>{setupRequired ? 'Create your admin account to take care of the everyday.' : 'A little care for your everyday collection.'}</p><form onSubmit={submit}>{setupRequired && <label className="form-field">Your name<input name="name" autoComplete="name" required maxLength={80} placeholder="First and last name" /></label>}<label className="form-field">Email address<input name="email" type="email" autoComplete="username" required maxLength={254} placeholder="you@example.com" /></label><label className="form-field">Password<span className="password-input"><input name="password" type={visible ? 'text' : 'password'} autoComplete={setupRequired ? 'new-password' : 'current-password'} minLength={12} maxLength={128} required placeholder={setupRequired ? 'At least 12 characters' : 'Enter your password'} /><button type="button" className="icon-button" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>{setupRequired && <p className="field-hint">Use at least 12 characters. This account is for managing your store.</p>}{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button full-width" disabled={busy}>{busy ? 'Just a moment…' : setupRequired ? 'Create admin account' : 'Sign in'}<ArrowRight size={15} /></button></form><a className="back-link" href="/"><ArrowLeft size={14} />Back to the shop</a></div><p className="auth-footer">Good things. Every day.</p></div><aside className="auth-visual"><img src="/images/carryall-pack.jpg" alt="An everyday bag, ready to go" /><div><span className="eyebrow">Behind the everyday</span><h2>Good things.<br />Thoughtfully managed.</h2><p>Your collection, your inventory, your next chapter.</p></div></aside></main>;
}

function ProductEditor({ product, onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [image, setImage] = useState(product?.image || '/images/atlas-headphones.jpg');
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const body = { ...form, price: Number(form.price), quantity: Number(form.quantity), lowStockThreshold: Number(form.lowStockThreshold), ...(product ? { revision: product.revision, archived: product.archived } : {}) };
    setBusy(true); setError('');
    try { await request(`/api/admin/products${product ? `/${product.id}` : ''}`, { method: product ? 'PATCH' : 'POST', body: JSON.stringify(body) }); await onSaved(product ? 'Product updated.' : 'Product added to your collection.'); onClose(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function archive() {
    setBusy(true); setError('');
    try { await request(`/api/admin/products/${product.id}`, { method: 'PATCH', body: JSON.stringify({ ...product, archived: !product.archived, reason: 'Inventory update' }) }); await onSaved(product.archived ? 'Product restored to the storefront.' : 'Product archived. You can restore it from the Archived tab.'); onClose(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <Modal title={product ? 'Edit product' : 'Add a product'} description="The little details that make your collection." onClose={onClose} wide><form onSubmit={submit} className="product-editor"><div className="editor-main"><label className="form-field">Product name<input name="name" defaultValue={product?.name} required maxLength={160} placeholder="e.g. Carryall Day Pack" /></label><div className="form-row"><label className="form-field">SKU<input name="sku" defaultValue={product?.sku} required maxLength={40} pattern="[A-Za-z0-9_-]+" placeholder="EC-0013" /></label><label className="form-field">Price (USD)<input name="price" type="number" min="0.01" max="100000" step="0.01" defaultValue={product?.price} required placeholder="0.00" /></label></div><div className="form-row"><label className="form-field">Category<select name="category" defaultValue={product?.category || 'Tech'}>{categories.map(category => <option key={category}>{category}</option>)}</select></label><label className="form-field">Colour<select name="colour" defaultValue={product?.colour || 'Black'}>{colours.map(colour => <option key={colour.name}>{colour.name}</option>)}</select></label></div><label className="form-field">Description<textarea name="description" rows={3} maxLength={2000} defaultValue={product?.description} placeholder="What makes this an everyday essential?" /></label><div className="editor-stock"><h3>Inventory</h3><div className="form-row"><label className="form-field">Stock quantity<input name="quantity" type="number" min="0" max="1000000" step="1" defaultValue={product?.quantity ?? 0} required /></label><label className="form-field">Low-stock threshold<input name="lowStockThreshold" type="number" min="0" max="1000000" step="1" defaultValue={product?.lowStockThreshold ?? 5} required /></label></div>{product && <label className="form-field">Adjustment reason<input name="reason" maxLength={240} defaultValue="Inventory count adjustment" required /></label>}<p className="field-hint">Stock is shared with the storefront. Changes are recorded in stock activity.</p></div></div><div className="editor-image"><img src={image} alt="Selected product image" /><label className="form-field">Catalog image<select name="image" value={image} onChange={event => setImage(event.target.value)}>{seedProducts.filter((p, i, all) => all.findIndex(other => other.image === p.image) === i).map(p => <option value={p.image} key={p.image}>{p.name}</option>)}</select></label><p className="field-hint">Choose from your existing catalog photography.</p></div>{error && <p className="form-error editor-error" role="alert">{error}</p>}<footer className="editor-actions">{product && <button className="text-button archive-button" type="button" disabled={busy} onClick={archive}><Archive size={14} />{product.archived ? 'Restore product' : 'Archive product'}</button>}<div><button className="outline-button" type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : product ? 'Save changes' : 'Add product'}<Check size={14} /></button></div></footer></form></Modal>;
}

function OrderDetail({ order, onClose, onSaved }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const next = { pending: ['processing', 'Start processing'], processing: ['shipped', 'Mark as shipped'], shipped: ['delivered', 'Mark as delivered'] }[order.status];
  async function update(status) {
    setBusy(true); setError('');
    try { await request(`/api/admin/orders/${order.id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); await onSaved(status === 'cancelled' ? 'Order cancelled and stock restored.' : 'Order status updated.'); onClose(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <Modal title={order.number} description={`Placed ${date(order.createdAt)} · Pay on delivery`} onClose={onClose}><div className="order-detail"><Status value={order.status} /><div className="order-delivery"><h3>Deliver to</h3><strong>{order.name}</strong><p>{order.email}</p><p>{order.address}<br />{order.city}, {order.postalCode}<br />{order.country}</p></div><div>{order.items.map((item, i) => <div className="summary-line" key={i}><img src={item.image} alt={item.name} /><div><strong>{item.name}</strong><p>{item.colour} · Qty {item.quantity}</p></div><span>{money(item.price * item.quantity)}</span></div>)}</div><div className="summary-totals"><div><span>Subtotal</span><span>{money(order.subtotal)}</span></div><div><span>Shipping</span><span>{order.shipping ? money(order.shipping) : 'Free'}</span></div><div className="summary-total"><strong>Total · Pay on delivery</strong><strong>{money(order.total)}</strong></div></div>{error && <p className="form-error" role="alert">{error}</p>}{['pending', 'processing'].includes(order.status) && <p className="field-hint">Cancelling this order restores its stock to the storefront.</p>}<footer className="order-detail-actions">{['pending', 'processing'].includes(order.status) && <button className="outline-button" disabled={busy} onClick={() => update('cancelled')}>Cancel order</button>}{next && <button className="primary-button" disabled={busy} onClick={() => update(next[0])}>{busy ? 'Updating…' : next[1]}<ArrowRight size={14} /></button>}</footer></div></Modal>;
}

function AdminDashboard({ admin, onLogout }) {
  const [section, setSection] = useState('inventory');
  const [products, setProducts] = useState([]); const [orders, setOrders] = useState([]); const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [search, setSearch] = useState(''); const [category, setCategory] = useState('all'); const [tab, setTab] = useState('all');
  const [editor, setEditor] = useState(null); const [orderDetail, setOrderDetail] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const load = useCallback(async (message) => {
    setLoading(true); setError('');
    try {
      const [inventory, sales, activity] = await Promise.all([request('/api/admin/products'), request('/api/admin/orders'), request('/api/admin/movements')]);
      setProducts(inventory.products); setOrders(sales.orders); setMovements(activity.movements); if (typeof message === 'string') setNotice(message);
    } catch (err) { if (err.status === 401) onLogout(); else setError(err.message); }
    finally { setLoading(false); }
  }, [onLogout]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 6000); return () => clearTimeout(timer); }, [notice]);
  const active = products.filter(p => !p.archived);
  const low = active.filter(p => p.quantity > 0 && p.quantity <= p.lowStockThreshold);
  const out = active.filter(p => p.quantity === 0);
  const archived = products.filter(p => p.archived);
  const filtered = products.filter(p => (tab === 'archived' ? p.archived : !p.archived) && (tab !== 'low' || p.quantity > 0 && p.quantity <= p.lowStockThreshold) && (tab !== 'out' || p.quantity === 0) && (category === 'all' || p.category === category) && `${p.name} ${p.sku} ${p.colour}`.toLowerCase().includes(search.toLowerCase()));
  const matchingOrders = orders.filter(order => `${order.number} ${order.name} ${order.email}`.toLowerCase().includes(search.toLowerCase()));
  const matchingActivity = movements.filter(m => `${m.product_name} ${m.sku} ${m.reason}`.toLowerCase().includes(search.toLowerCase()));
  async function logout() {
    setLoggingOut(true);
    try { await request('/api/admin/logout', { method: 'POST', body: '{}' }); onLogout(); }
    catch (err) { setError(err.message); }
    finally { setLoggingOut(false); }
  }
  function exportInventory() {
    const safe = value => `"${String(value).replace(/^[=+\-@\t\r]/, "'$&").replaceAll('"', '""')}"`;
    const rows = [['SKU', 'Name', 'Category', 'Colour', 'Price (USD)', 'Stock', 'Low stock threshold', 'Status'], ...filtered.map(p => [p.sku, p.name, p.category, p.colour, p.price.toFixed(2), p.quantity, p.lowStockThreshold, stockState(p)])];
    const url = URL.createObjectURL(new Blob([rows.map(row => row.map(safe).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'everyday-inventory.csv'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const titles = { inventory: ['Inventory', 'A little care for everything in your collection.'], orders: ['Orders', 'From your collection to their everyday.'], activity: ['Stock activity', 'Every change, thoughtfully kept on record.'] };
  function switchSection(next) { setSection(next); setSearch(''); }
  return <div className="admin-layout"><aside className="admin-sidebar"><a className="wordmark" href="/">everyday<span>®</span></a><span className="eyebrow">Store admin</span><nav aria-label="Admin navigation"><button className={section === 'inventory' ? 'active' : ''} onClick={() => switchSection('inventory')}><LayoutGrid size={16} />Inventory<span>{active.length}</span></button><button className={section === 'orders' ? 'active' : ''} onClick={() => switchSection('orders')}><ShoppingBag size={16} />Orders{orders.filter(o => o.status === 'pending').length > 0 && <span>{orders.filter(o => o.status === 'pending').length}</span>}</button><button className={section === 'activity' ? 'active' : ''} onClick={() => switchSection('activity')}><History size={16} />Stock activity</button></nav><a className="back-link admin-store-link" href="/"><ArrowLeft size={14} />View storefront</a><div className="admin-user"><span className="admin-avatar">{admin.name.slice(0, 1).toUpperCase()}</span><div><strong>{admin.name}</strong><span>{admin.email}</span></div><button className="icon-button" aria-label="Sign out" title="Sign out" disabled={loggingOut} onClick={logout}><LogOut size={15} /></button></div></aside><main className="admin-main"><div className="admin-topline"><span className="eyebrow">Everyday carry / {titles[section][0]}</span><span className="admin-access"><span />Admin workspace</span></div><header className="admin-page-header"><div><h1>{titles[section][0]}</h1><p>{titles[section][1]}</p></div><div className="admin-header-actions"><button className="outline-button refresh-button" aria-label="Refresh inventory and orders" disabled={loading} onClick={() => load()}><RefreshCw size={14} /></button>{section === 'inventory' && <><button className="outline-button export-button" onClick={exportInventory} disabled={loading}><Download size={14} />Export</button><button className="primary-button" onClick={() => setEditor({ product: null })}><Plus size={15} />Add product</button></>}</div></header>
    <div className="inventory-metrics"><div><span>Total products <Package size={15} /></span><strong>{active.length}<small>in your collection</small></strong></div><div><span>Units available <LayoutGrid size={15} /></span><strong>{active.reduce((sum, p) => sum + p.quantity, 0).toLocaleString()}<small>across active products</small></strong></div><div><span>Low stock <span className="metric-dot" /></span><strong>{low.length}<small>{out.length} out of stock</small></strong></div><div><span>Inventory value <span>USD</span></span><strong>{money(active.reduce((sum, p) => sum + Math.round(p.price * 100) * p.quantity, 0) / 100)}<small>at current retail prices</small></strong></div></div>
    {notice && <div className="admin-notice" role="status"><Check size={15} />{notice}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={13} /></button></div>}{error && <div className="form-error admin-error" role="alert">{error}<button className="text-button" onClick={() => load()}>Try again</button></div>}
    <section className="inventory-section" aria-label={titles[section][0]}>{section === 'inventory' && <div className="inventory-tabs" aria-label="Inventory views">{[['all', 'All products', active.length], ['low', 'Low stock', low.length], ['out', 'Out of stock', out.length], ['archived', 'Archived', archived.length]].map(([key, label, count]) => <button aria-pressed={tab === key} className={tab === key ? 'active' : ''} key={key} onClick={() => setTab(key)}>{label}<span>{count}</span></button>)}</div>}
      <div className="inventory-toolbar"><label className="admin-search"><Search size={15} /><input aria-label={`Search ${section}`} value={search} onChange={event => setSearch(event.target.value)} placeholder={section === 'inventory' ? 'Search products or SKU…' : section === 'orders' ? 'Search orders or customers…' : 'Search stock activity…'} />{search && <button className="icon-button" aria-label="Clear search" onClick={() => setSearch('')}><X size={13} /></button>}</label>{section === 'inventory' && <div className="sort-control"><select aria-label="Filter inventory by category" value={category} onChange={event => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select><ChevronDown size={14} /></div>}<span className="table-count">{section === 'inventory' ? `${filtered.length} products` : section === 'orders' ? `${matchingOrders.length} orders` : `${matchingActivity.length} changes`}</span></div>
      {loading && !products.length ? <div className="admin-empty">Loading your store…</div> : section === 'inventory' ? <div className="table-scroll"><table className="inventory-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th><span className="visually-hidden">Actions</span></th></tr></thead><tbody>{filtered.map(p => <tr key={p.id}><td><button className="table-product" onClick={() => setEditor({ product: p })}><img src={p.image} alt="" /><span><strong>{p.name}</strong><small>{p.sku} <span>·</span> {p.colour}</small></span></button></td><td className="muted">{p.category}</td><td>{money(p.price)}</td><td><span className={p.quantity <= p.lowStockThreshold ? 'stock-attention' : ''}>{p.quantity}</span><small className="stock-unit"> units</small></td><td><Status value={stockState(p)} /></td><td><button className="icon-button" aria-label={`Edit ${p.name}`} onClick={() => setEditor({ product: p })}><Pencil size={14} /></button></td></tr>)}</tbody></table>{!filtered.length && <div className="admin-empty"><Package size={24} strokeWidth={1} /><h3>No products here yet</h3><p>Try another search or add something to your collection.</p><button className="outline-button" onClick={() => { setSearch(''); setCategory('all'); setTab('all'); }}>Clear filters</button></div>}</div> : section === 'orders' ? <div className="table-scroll"><table className="inventory-table"><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Total</th><th>Placed</th><th><span className="visually-hidden">Actions</span></th></tr></thead><tbody>{matchingOrders.map(order => <tr key={order.id}><td><button className="order-number" onClick={() => setOrderDetail(order)}>{order.number}</button><small className="table-subtext">{order.items.reduce((sum, item) => sum + item.quantity, 0)} items · Pay on delivery</small></td><td><strong className="customer-name">{order.name}</strong><small className="table-subtext">{order.email}</small></td><td><Status value={order.status} /></td><td>{money(order.total)}</td><td className="muted">{date(order.createdAt)}</td><td><button className="icon-button" aria-label={`View order ${order.number}`} onClick={() => setOrderDetail(order)}><ArrowRight size={15} /></button></td></tr>)}</tbody></table>{!matchingOrders.length && <div className="admin-empty"><ShoppingBag size={24} strokeWidth={1} /><h3>{search ? 'No matching orders' : 'Your next chapter starts here'}</h3><p>{search ? 'Try a different order number or customer.' : 'Orders placed at checkout will appear here.'}</p></div>}</div> : <div className="table-scroll"><table className="inventory-table activity-table"><thead><tr><th>Product</th><th>Change</th><th>Stock after</th><th>Reason</th><th>By / Date</th></tr></thead><tbody>{matchingActivity.map(m => <tr key={m.id}><td><strong>{m.product_name}</strong><small className="table-subtext">{m.sku}</small></td><td className={m.delta > 0 ? 'positive-change' : ''}>{m.delta > 0 ? '+' : ''}{m.delta}</td><td>{m.quantity_after}</td><td>{m.reason}</td><td><span>{m.admin_name || (m.order_id ? 'Checkout' : 'Catalog setup')}</span><small className="table-subtext">{date(m.created_at)}</small></td></tr>)}</tbody></table>{!matchingActivity.length && <div className="admin-empty">No stock changes match your search.</div>}</div>}
      <footer className="table-footer"><span>{section === 'inventory' ? 'Stock changes are reflected in the storefront.' : section === 'orders' ? 'Showing the latest 200 orders. Payment is collected on delivery.' : 'Showing the latest 200 stock changes.'}</span><span><span className="saved-dot" />Saved to your store</span></footer>
    </section><p className="admin-bottom-note">A place for everything. And everything in its place.</p>
  </main>{editor && <ProductEditor product={editor.product} onClose={() => setEditor(null)} onSaved={load} />}{orderDetail && <OrderDetail order={orderDetail} onClose={() => setOrderDetail(null)} onSaved={load} />}</div>;
}

export default function AdminApp() {
  const [admin, setAdmin] = useState(null); const [setupRequired, setSetupRequired] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const logout = useCallback(() => setAdmin(null), []);
  const session = useCallback(async () => {
    try { const result = await request('/api/admin/session'); setAdmin(result.admin); setSetupRequired(result.setupRequired); setError(''); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { document.title = 'Store admin — Everyday carry'; session(); }, [session]);
  if (loading) return <main className="store-message">Opening your workspace…</main>;
  if (error) return <main className="store-message"><h1>Unable to open your workspace</h1><p>{error}</p><button className="outline-button" onClick={session}>Try again</button><a href="/">Back to shop</a></main>;
  return admin ? <AdminDashboard admin={admin} onLogout={logout} /> : <AdminAuth setupRequired={setupRequired} onAuthenticated={value => { setAdmin(value); setSetupRequired(false); }} reloadSession={session} />;
}
