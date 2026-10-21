import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Minus, Plus, Search, ShieldCheck, ShoppingBag, Truck, Undo2, X } from 'lucide-react';
import { categories } from './data';
import { money, request } from './api';
import { useShop } from './shop-context';

function Quantity({ value, max = 99, onChange, label = 'Quantity' }) {
  return <div className="quantity-control"><button type="button" aria-label={`Decrease ${label}`} disabled={value <= 1} onClick={() => onChange(value - 1)}><Minus size={13} /></button><span aria-label={label}>{value}</span><button type="button" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}><Plus size={13} /></button></div>;
}
export function StoreLayout({ children }) {
  const { count, cartOpen, setCartOpen } = useShop();
  const [info, setInfo] = useState(null);
  const infoDialog = useRef(null);
  const infoContent = {
    shipping: ['Shipping & returns', 'Standard delivery is $8, and free on orders of $200 or more. You can return an unused item in its original condition within 60 days of delivery. Delivery arrangements are confirmed by the store when your order is processed.'],
    payment: ['A simple checkout', 'Place your order and pay on delivery. There is no online payment or card charge. Your order confirmation is available immediately after checkout, and the store manages your order through its admin dashboard.'],
    about: ['The everyday, considered.', 'Everyday carry brings together bags, bottles, apparel and small tech for the things you do every day. A focused collection of practical essentials, all in one place.'],
  };
  function openInfo(key) { setInfo(infoContent[key]); infoDialog.current.showModal(); }
  return <>
    <div className="announcement">A little less to carry. <span>Free shipping on orders $200+</span></div>
    <header className="store-header"><div className="store-nav"><a className="wordmark" href="/">everyday<span>®</span></a>
      <nav aria-label="Main navigation"><a href="/" className={location.pathname === '/' && !location.search ? 'current' : ''}>Shop all</a>{categories.map(category => <a href={`/?category=${category}`} key={category} className={new URLSearchParams(location.search).get('category') === category ? 'current' : ''}>{category}</a>)}</nav>
      <div className="store-nav-actions"><a className="search-link" href="/?search=1" aria-label="Search products"><Search size={19} /></a><button className="cart-trigger" aria-label={`Open shopping bag, ${count} items`} onClick={() => setCartOpen(true)}><ShoppingBag size={18} /><span>Bag <span className="bag-count">{count}</span></span></button></div>
    </div></header>
    {children}
    <section className="store-promises" aria-label="Store benefits"><div><Truck size={19} /><span><strong>On us, over $200</strong><small>Complimentary standard shipping</small></span></div><div><Undo2 size={19} /><span><strong>A little time to decide</strong><small>Free returns for 60 days</small></span></div><div><ShieldCheck size={19} /><span><strong>Keep checkout simple</strong><small>Order now, pay on delivery</small></span></div></section>
    <footer className="store-footer"><div><a className="wordmark" href="/">everyday<span>®</span></a><p>Good things. Every day.</p></div><div className="footer-links"><button onClick={() => openInfo('about')}>Our story</button><button onClick={() => openInfo('shipping')}>Shipping & returns</button><button onClick={() => openInfo('payment')}>Payment</button><a href="/admin">Store admin <ArrowRight size={12} /></a></div><p className="copyright">© {new Date().getFullYear()} Everyday carry</p></footer>
    <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    <dialog className="content-dialog" ref={infoDialog} onClick={event => { if (event.target === event.currentTarget) infoDialog.current.close(); }} aria-labelledby="info-title"><div><button className="dialog-close icon-button" aria-label="Close information" onClick={() => infoDialog.current.close()}><X size={18} /></button><span className="eyebrow">Everyday carry</span><h2 id="info-title">{info?.[0]}</h2><p>{info?.[1]}</p><button className="outline-button" onClick={() => infoDialog.current.close()}>Got it</button></div></dialog>
  </>;
}

function CartDrawer({ open, onClose }) {
  const dialog = useRef(null);
  const { lines, subtotal, count, loading, invalid, setQuantity } = useShop();
  useEffect(() => {
    if (open) { dialog.current.showModal(); document.body.style.overflow = 'hidden'; }
    else if (dialog.current.open) dialog.current.close();
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  const shipping = subtotal >= 200 ? 0 : 8;
  return <dialog className="cart-drawer" ref={dialog} aria-labelledby="bag-title" onClose={() => { document.body.style.overflow = ''; onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="cart-drawer-inner"><header className="drawer-header"><div><span className="eyebrow">Your essentials</span><h2 id="bag-title">Shopping bag <span>({count})</span></h2></div><button className="icon-button" aria-label="Close shopping bag" onClick={onClose}><X size={20} /></button></header>
      <div className="cart-drawer-body">{!lines.length ? <div className="bag-empty"><ShoppingBag size={32} strokeWidth={1} /><h3>A little room for everyday.</h3><p>Your bag is empty. Find something to take along.</p><button className="primary-button" onClick={onClose}>Continue shopping <ArrowRight size={14} /></button></div> : <>
        <p className="shipping-progress">{subtotal >= 200 ? 'Your order ships for free.' : `You’re ${money(200 - subtotal)} away from free shipping.`}</p><div className="progress-track"><span style={{ width: `${Math.min(100, subtotal / 2)}%` }} /></div>
        {lines.map(line => <div className="bag-line" key={line.id}>{line.product && <a href={`/product/${line.id}`}><img src={line.product.image} alt={line.product.name} /></a>}<div className="bag-line-info"><div><a href={line.product ? `/product/${line.id}` : undefined}>{line.product?.name || 'Unavailable product'}</a><span>{money((line.product?.price || 0) * line.quantity)}</span></div><p>{line.product?.colour || 'Removed from the catalog'}</p>{line.product && line.quantity > line.product.available && <p className="inline-error">Only {line.product.available} available. Update your quantity.</p>}<div><Quantity value={line.quantity} max={line.product?.available || 1} onChange={quantity => setQuantity(line.id, quantity)} label={line.product?.name} /><button className="text-button" onClick={() => setQuantity(line.id, 0)}>Remove</button></div></div></div>)}
      </>}</div>
      {lines.length > 0 && <footer className="cart-drawer-footer"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><p>{shipping ? '$8 standard shipping. Pay on delivery.' : 'Free shipping. Pay on delivery.'}</p>{invalid && <p className="inline-error">Please update unavailable items before checking out.</p>}<a className={`primary-button full-width ${invalid || loading ? 'disabled-link' : ''}`} href={invalid || loading ? undefined : '/checkout'} aria-disabled={invalid || loading}>Checkout <ArrowRight size={15} /></a><button className="text-button" onClick={onClose}>Continue shopping</button></footer>}
    </div>
  </dialog>;
}

export function ProductPage() {
  const { catalog, loading, error, addToCart, refresh } = useShop();
  const [quantity, setQuantity] = useState(1);
  const id = decodeURIComponent(location.pathname.slice('/product/'.length));
  const product = catalog.find(item => item.id === id);
  useEffect(() => { if (product) document.title = `${product.name} — Everyday carry`; }, [product?.name]);
  if (loading) return <main className="store-message">Loading your next everyday essential…</main>;
  if (!product) return <main className="store-message"><h1>{error ? 'Unable to load product' : 'Product not found'}</h1><p>{error || 'This item is no longer in our collection.'}</p>{error ? <button className="outline-button" onClick={refresh}>Try again</button> : <a className="outline-button" href="/">Back to shop</a>}</main>;
  const related = catalog.filter(item => item.id !== id && item.category === product.category).slice(0, 3);
  return <main className="product-page container"><nav className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Shop</a><span>/</span><a href={`/?category=${product.category}`}>{product.category}</a><span>/</span><span>{product.name}</span></nav>
    <div className="product-detail-grid"><div className="detail-photo"><img src={product.image} alt={product.name} /></div><div className="detail-info"><span className="eyebrow">The everyday collection · {product.category}</span><h1>{product.name}</h1><div className="detail-price"><span>{money(product.price)}</span>{product.reviews > 0 && <span className="muted">★ {product.rating.toFixed(1)} <span className="review-count">({product.reviews.toLocaleString()} reviews)</span></span>}</div><p className="detail-description">{product.description}</p><div className="detail-colour"><span>Colour <strong>{product.colour}</strong></span><span className="detail-swatch" data-colour={product.colour} /></div><div className="detail-stock"><span className={`status-dot ${product.inStock ? 'available' : 'unavailable'}`} />{product.inStock ? 'In stock · ready for your everyday' : 'Currently sold out'}</div><div className="purchase-row"><Quantity value={quantity} max={Math.min(99, product.available)} onChange={setQuantity} /><button className="primary-button" disabled={!product.inStock} onClick={() => addToCart(product, quantity)}>{product.inStock ? 'Add to bag' : 'Sold out'}<ShoppingBag size={16} /></button></div><p className="detail-payment-note">Pay on delivery. No online payment required.</p><div className="detail-benefits"><span><Truck size={16} />Free shipping over $200</span><span><Undo2 size={16} />Free returns for 60 days</span></div><details className="product-accordion" open><summary>Details <ChevronDown size={16} /></summary><p>{product.description} Available in {product.colour.toLowerCase()}.</p></details><details className="product-accordion"><summary>Shipping & returns <ChevronDown size={16} /></summary><p>Standard shipping is $8, or free on orders of $200 or more. Return unused items in their original condition within 60 days. The store will confirm delivery arrangements when processing your order.</p></details></div></div>
    {related.length > 0 && <section className="related-section"><span className="eyebrow">Better together</span><h2>More for your everyday</h2><div className="related-grid">{related.map(item => <a className="related-card" href={`/product/${item.id}`} key={item.id}><img src={item.image} alt={item.name} /><div><h3>{item.name}</h3><span>{money(item.price)}</span></div><p>{item.colour}</p></a>)}</div></section>}
  </main>;
}

export function CheckoutPage() {
  const { lines, subtotal, invalid, loading, error: catalogError, clearCart, refresh } = useShop();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const shipping = subtotal >= 200 ? 0 : 8;
  useEffect(() => { document.title = 'Checkout — Everyday carry'; }, []);
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    const body = { ...Object.fromEntries(new FormData(event.currentTarget)), items: lines.map(({ id, quantity }) => ({ id, quantity })) };
    const signature = JSON.stringify(body);
    let checkout;
    try { checkout = JSON.parse(sessionStorage.getItem('ec-checkout')); } catch { /* Start a new checkout. */ }
    if (checkout?.signature !== signature) checkout = { signature, key: crypto.randomUUID() };
    try {
      sessionStorage.setItem('ec-checkout', JSON.stringify(checkout));
      const { order } = await request('/api/orders', { method: 'POST', headers: { 'Idempotency-Key': checkout.key }, body: JSON.stringify(body) });
      sessionStorage.setItem('ec-last-order', JSON.stringify(order));
      sessionStorage.removeItem('ec-checkout');
      localStorage.setItem('ec-cart', '[]'); clearCart();
      location.assign('/order-confirmation');
    } catch (err) { setError(err.message); await refresh(); setBusy(false); }
  }
  if (loading) return <main className="store-message">Loading checkout…</main>;
  if (catalogError) return <main className="store-message"><h1>Let’s reconnect.</h1><p>{catalogError}</p><button className="outline-button" onClick={refresh}>Reload your bag</button><a href="/">Back to shop</a></main>;
  if (!lines.length) return <main className="store-message"><ShoppingBag size={32} strokeWidth={1} /><h1>Your bag is empty</h1><p>A few good things are waiting for you.</p><a href="/" className="primary-button">Explore the collection <ArrowRight size={16} /></a></main>;
  return <main className="checkout-page container"><a className="back-link" href="/"><ArrowLeft size={14} />Back to shop</a><header className="category-header"><span className="eyebrow">One more thing</span><h1>Make it yours.</h1><p>Your everyday essentials, on their way.</p></header><div className="checkout-grid"><form onSubmit={submit} className="checkout-form"><section><h2><span>01</span> Contact</h2><label className="form-field">Email address<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" /></label><p className="field-hint">Your order confirmation is shown after checkout. No email is sent.</p></section><section><h2><span>02</span> Delivery details</h2><label className="form-field">Full name<input name="name" autoComplete="name" required maxLength={100} placeholder="First and last name" /></label><label className="form-field">Street address<input name="address" autoComplete="street-address" required maxLength={200} placeholder="House number and street, apartment if applicable" /></label><div className="form-row"><label className="form-field">City<input name="city" autoComplete="address-level2" required maxLength={100} /></label><label className="form-field">Postal code<input name="postalCode" autoComplete="postal-code" required maxLength={20} /></label></div><label className="form-field">Country<input name="country" autoComplete="country-name" required maxLength={80} /></label></section><section><h2><span>03</span> Payment</h2><div className="payment-option"><span className="payment-radio" /><div><strong>Pay on delivery</strong><p>No payment now. Pay when your order arrives.</p></div><ShieldCheck size={20} /></div></section>{error && <p className="form-error" role="alert">{error}</p>}{invalid && <p className="form-error" role="alert">Some items are no longer available in the quantities selected. <a href="/">Return to your bag and update them.</a></p>}<button className="primary-button checkout-submit" disabled={busy || invalid}>{busy ? 'Placing your order…' : `Place order · ${money(subtotal + shipping)}`}<ArrowRight size={16} /></button><p className="checkout-note">Payment is collected on delivery. Your order is saved with the store for processing.</p></form><aside className="order-summary"><h2>In your bag <span>({lines.reduce((sum, line) => sum + line.quantity, 0)})</span></h2>{lines.map(line => <div className="summary-line" key={line.id}>{line.product && <img src={line.product.image} alt={line.product.name} />}<div><strong>{line.product?.name || 'Unavailable product'}</strong><p>{line.product?.colour} · Qty {line.quantity}</p></div><span>{money((line.product?.price || 0) * line.quantity)}</span></div>)}<div className="summary-totals"><div><span>Subtotal</span><span>{money(subtotal)}</span></div><div><span>Shipping</span><span>{shipping ? money(shipping) : 'Free'}</span></div><div className="summary-total"><strong>Total</strong><strong><small>USD</small> {money(subtotal + shipping)}</strong></div></div><p className="summary-footnote"><Undo2 size={14} />A little time to decide. Free returns for 60 days.</p></aside></div></main>;
}

export function OrderConfirmation() {
  let order;
  try { order = JSON.parse(sessionStorage.getItem('ec-last-order')); } catch { /* No order in this browser. */ }
  if (!order) return <main className="store-message"><h1>No recent order</h1><p>Your order confirmation will appear here after checkout.</p><a href="/" className="outline-button">Back to shop</a></main>;
  return <main className="confirmation-page container"><div className="confirmation-check"><Check size={26} strokeWidth={1.5} /></div><span className="eyebrow">Order {order.number}</span><h1>Good things are coming.</h1><p>Thanks, {order.name.split(' ')[0]}. Your order has been received.</p><div className="confirmation-details"><div><span>Order status</span><strong>Awaiting processing</strong></div><div><span>Payment</span><strong>Pay on delivery</strong></div><div><span>Order total</span><strong>{money(order.total)}</strong></div></div><p className="muted">Keep your order number for reference. This confirmation is saved in this browser tab; no email has been sent.</p><a className="primary-button" href="/">Back to the everyday <ArrowRight size={15} /></a></main>;
}
