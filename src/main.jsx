import React, { useEffect, useId, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChevronDown, Check, Search, SlidersHorizontal, Star, X } from 'lucide-react';
import { categories, colours, ratings, emptyFilters, matches, getResults, toggle } from './data';
import AdminApp from './admin';
import { ShopProvider, useShop } from './shop-context';
import { CheckoutPage, OrderConfirmation, ProductPage, StoreLayout } from './commerce';
import { money } from './api';
import './styles.css';
import './commerce.css';

function Stars({ value }) {
  const rounded = Math.round(value * 2) / 2;
  return <span className="stars" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <span className="star" key={index}>
    <Star className="star-outline" /><span className="star-fill" style={{ width: `${Math.max(0, Math.min(1, rounded - index)) * 100}%` }}><Star /></span>
  </span>)}</span>;
}

function FilterPanel({ filters, setFilters, prefix }) {
  const { catalog: products } = useShop();
  const update = patch => setFilters(current => ({ ...current, ...patch }));
  return <div className="filter-panel">
    <fieldset className="filter-section categories"><legend>Category</legend>
      {categories.map(category => {
        const count = products.filter(product => product.category === category && matches(product, filters, true)).length;
        const checked = filters.categories.includes(category);
        return <label className="check-row" key={category}>
          <input type="checkbox" checked={checked} disabled={!count && !checked} onChange={() => update({ categories: toggle(filters.categories, category) })} />
          <span className="custom-check"><Check size={11} strokeWidth={3} /></span><span>{category}</span><span className="category-count">{count}</span>
        </label>;
      })}
    </fieldset>
    <fieldset className="filter-section price-section"><legend>Price</legend>
      <div className="range-control" style={{ '--min': `${filters.price[0] / 4}%`, '--max': `${filters.price[1] / 4}%` }}>
        <div className="range-track"><div /></div>
        <input type="range" aria-label="Minimum price" min="0" max="400" step="10" value={filters.price[0]} onChange={event => update({ price: [Math.min(Number(event.target.value), filters.price[1] - 10), filters.price[1]] })} />
        <input type="range" aria-label="Maximum price" min="0" max="400" step="10" value={filters.price[1]} onChange={event => update({ price: [filters.price[0], Math.max(Number(event.target.value), filters.price[0] + 10)] })} />
      </div>
      <div className="price-values"><span>${filters.price[0]}</span><span>${filters.price[1]}{filters.price[1] === 400 ? '+' : ''}</span></div>
    </fieldset>
    <fieldset className="filter-section"><legend>Colour</legend>
      <div className="swatches">{colours.map(colour => <button type="button" className={`swatch ${filters.colours.includes(colour.name) ? 'selected' : ''}`} key={colour.name} aria-label={colour.name} aria-pressed={filters.colours.includes(colour.name)} title={colour.name} style={{ backgroundColor: colour.swatch }} onClick={() => update({ colours: toggle(filters.colours, colour.name) })} />)}</div>
    </fieldset>
    <div className="stock-section"><label htmlFor={`${prefix}-stock`}>In stock only</label><button id={`${prefix}-stock`} className="switch" type="button" role="switch" aria-checked={filters.inStock} onClick={() => update({ inStock: !filters.inStock })}><span /></button></div>
    <fieldset className="filter-section rating-section"><legend>Rating</legend>
      {ratings.map(rating => <label className="radio-row" key={rating.value}>
        <input type="radio" name={`${prefix}-rating`} value={rating.value} checked={filters.rating === rating.value} onChange={() => update({ rating: rating.value })} />
        <span className="custom-radio" />{rating.min > 0 && <Stars value={rating.min} />}<span>{rating.label}</span>
      </label>)}
    </fieldset>
  </div>;
}

function ProductCard({ product, index }) {
  return <article className="product-card" style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}>
    <a href={`/product/${product.id}`} className={`product-image ${product.inStock ? '' : 'sold-out'}`} aria-label={`View ${product.name}`}>
      <img src={product.image} alt={product.name} loading={index > 5 ? 'lazy' : 'eager'} width="480" height="600" />
      {!product.inStock && <span className="sold-out-badge">Sold out</span>}
    </a>
    <div className="product-info"><div className="product-heading"><h2><a href={`/product/${product.id}`}>{product.name}</a></h2><span className="product-price">{money(product.price)}</span></div>
      <p className="product-colour">{product.colour}</p>
      {product.reviews > 0 ? <div className="product-rating" aria-label={`Rated ${product.rating} out of 5, ${product.reviews.toLocaleString('en-US')} reviews`}><Stars value={product.rating} /><span>{product.rating.toFixed(1)}</span><span>({product.reviews.toLocaleString('en-US')})</span></div> : <span className="product-colour">New arrival</span>}
    </div>
  </article>;
}

function App() {
  const { catalog, loading, error, refresh } = useShop();
  const [filters, setFilters] = useState(() => {
    const category = new URLSearchParams(location.search).get('category');
    return categories.includes(category) ? { ...emptyFilters, categories: [category] } : emptyFilters;
  });
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('featured');
  const sheet = useRef(null);
  const trigger = useRef(null);
  const id = useId();
  const results = getResults(filters, sort, catalog).filter(product => `${product.name} ${product.category} ${product.colour}`.toLowerCase().includes(search.toLowerCase()));
  const clearAll = () => setFilters(emptyFilters);
  const active = [
    ...filters.categories.map(value => ({ key: `category-${value}`, label: value, remove: () => setFilters(current => ({ ...current, categories: toggle(current.categories, value) })) })),
    ...(filters.price[0] !== 0 || filters.price[1] !== 400 ? [{ key: 'price', label: `$${filters.price[0]} to $${filters.price[1]}`, remove: () => setFilters(current => ({ ...current, price: [0, 400] })) }] : []),
    ...filters.colours.map(value => ({ key: `colour-${value}`, label: value, remove: () => setFilters(current => ({ ...current, colours: toggle(current.colours, value) })) })),
    ...(filters.inStock ? [{ key: 'stock', label: 'In stock', remove: () => setFilters(current => ({ ...current, inStock: false })) }] : []),
    ...(filters.rating !== 'any' ? [{ key: 'rating', label: ratings.find(rating => rating.value === filters.rating).label, remove: () => setFilters(current => ({ ...current, rating: 'any' })) }] : []),
  ];
  const openSheet = () => { sheet.current.showModal(); document.body.style.overflow = 'hidden'; };
  const closeSheet = () => sheet.current.close();
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const onResize = () => { if (media.matches && sheet.current.open) sheet.current.close(); };
    media.addEventListener('change', onResize);
    return () => { media.removeEventListener('change', onResize); document.body.style.overflow = ''; };
  }, []);
  return <main className="shop-page"><div className="container">
    <header className="category-header"><span className="eyebrow enter">Shop / The everyday collection</span><h1 className="enter" style={{ animationDelay: '80ms' }}>Everyday carry</h1><p className="enter" style={{ animationDelay: '160ms' }}>Bags, bottles and small tech we use every day. Free shipping over $200 and free returns for 60 days.</p></header>
    <label className="catalog-search"><Search size={16} /><input aria-label="Search the collection" placeholder="Find your everyday essential…" value={search} onChange={event => setSearch(event.target.value)} autoFocus={new URLSearchParams(location.search).has('search')} />{search && <button className="icon-button" aria-label="Clear product search" onClick={() => setSearch('')}><X size={14} /></button>}</label>
    <div className="catalog-layout">
      <aside className="desktop-filters enter" aria-label="Filters" style={{ animationDelay: '240ms' }}>
        <div className="filter-header"><h2>Filters</h2><button className="clear-button" onClick={clearAll} disabled={!active.length}>Clear all</button></div>
        <FilterPanel filters={filters} setFilters={setFilters} prefix={`${id}-desktop`} />
      </aside>
      <section className="results enter" aria-label="Products" style={{ animationDelay: '320ms' }}>
        <div className="results-toolbar"><div className="toolbar-row"><div className="result-count-wrap">
          <button className="mobile-filter-button" ref={trigger} onClick={openSheet}><SlidersHorizontal size={14} />Filters{active.length > 0 && ` (${active.length})`}</button>
          <p className="result-count" role="status">{results.length} {results.length === 1 ? 'product' : 'products'}</p>
        </div><div className="sort-control"><select aria-label="Sort products" value={sort} onChange={event => setSort(event.target.value)}><option value="featured">Featured</option><option value="price-asc">Price low to high</option><option value="price-desc">Price high to low</option><option value="newest">Newest</option></select><ChevronDown size={14} /></div></div>
        {active.length > 0 && <ul className="active-filters" aria-label="Active filters">{active.map(filter => <li key={filter.key}><span className="filter-chip">{filter.label}<button type="button" aria-label={`Remove ${filter.label}`} onClick={filter.remove}><X size={12} /></button></span></li>)}<li><button className="clear-button" onClick={clearAll}>Clear all</button></li></ul>}
        </div>
        {error && <div className="form-error" role="alert">{error} <button className="text-button" onClick={refresh}>Try again</button></div>}
        {loading ? <div className="product-grid" aria-label="Loading products">{Array.from({ length: 6 }, (_, index) => <div className="product-skeleton" key={index}><div /><span /><span /></div>)}</div> : results.length ? <div className="product-grid" key={JSON.stringify([filters, sort, search])}>{results.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div> : !error && <div className="empty-state"><h2>Nothing matches those filters</h2><p>Try a wider price range or fewer colours. Sold out items come back most weeks.</p><button className="outline-button" onClick={() => { clearAll(); setSearch(''); }}>Clear filters</button></div>}
      </section>
    </div>
    <dialog className="filter-sheet" ref={sheet} aria-labelledby="sheet-title" aria-describedby="sheet-description" onClick={event => { if (event.target === event.currentTarget) closeSheet(); }} onClose={() => { document.body.style.overflow = ''; trigger.current?.focus(); }}>
      <div className="sheet-inner"><header className="sheet-header"><div><h2 id="sheet-title">Filters</h2><p id="sheet-description">Results update as you change them.</p></div><button className="icon-button" aria-label="Close filters" onClick={closeSheet}><X size={18} /></button></header>
        <div className="sheet-body"><FilterPanel filters={filters} setFilters={setFilters} prefix={`${id}-mobile`} /></div>
        <footer className="sheet-footer"><button className="outline-button" disabled={!active.length} onClick={clearAll}>Clear all</button><button className="primary-button" onClick={closeSheet}>{results.length ? `Show ${results.length} ${results.length === 1 ? 'result' : 'results'}` : 'No matches'}</button></footer>
      </div>
    </dialog>
  </div></main>;
}

function Site() {
  const path = location.pathname;
  if (path === '/admin' || path.startsWith('/admin/')) return <AdminApp />;
  let page = path === '/' ? <App /> : path.startsWith('/product/') ? <ProductPage /> : path === '/checkout' ? <CheckoutPage /> : path === '/order-confirmation' ? <OrderConfirmation /> : <main className="store-message"><h1>A little off the path.</h1><p>We couldn’t find that page.</p><a href="/" className="outline-button">Back to shop</a></main>;
  return <ShopProvider><StoreLayout>{page}</StoreLayout></ShopProvider>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><Site /></React.StrictMode>);
