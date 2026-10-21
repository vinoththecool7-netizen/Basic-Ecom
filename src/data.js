export const categories = ['Tech', 'Bags', 'Apparel', 'Outdoor'];
export const colours = [
  { name: 'Black', swatch: '#202124' },
  { name: 'White', swatch: '#f6f5f2' },
  { name: 'Sand', swatch: '#d4c7af' },
  { name: 'Olive', swatch: '#71794b' },
  { name: 'Navy', swatch: '#273752' },
];
export const ratings = [ { value: 'any', label: 'Any rating', min: 0 }, { value: '4', label: '4 stars & up', min: 4 }, { value: '3', label: '3 stars & up', min: 3 } ];
export const products = [
  ['atlas-headphones', 'Atlas Over-Ear Headphones', 'Tech', 'Black', 249, 4.8, 1204, true, '2026-03-10', 'atlas-headphones'],
  ['carryall-pack', 'Carryall Day Pack', 'Bags', 'Olive', 96, 4.7, 566, true, '2026-05-21', 'carryall-pack'],
  ['meridian-watch', 'Meridian Chrono Watch', 'Tech', 'Navy', 389, 4.9, 318, true, '2026-01-14', 'meridian-watch'],
  ['volt-runners', 'Volt Runner Sneakers', 'Apparel', 'White', 129, 4.6, 942, true, '2026-08-30', 'volt-runners'],
  ['horizon-sunglasses', 'Horizon Sunglasses', 'Outdoor', 'Black', 74, 4.5, 211, true, '2026-04-02', 'horizon-sunglasses'],
  ['pioneer-camera', 'Pioneer Instant Camera', 'Tech', 'White', 179, 4.7, 689, false, '2026-09-02', 'pioneer-camera'],
  ['hydra-bottle', 'Hydra Steel Bottle, 750 ml', 'Outdoor', 'Black', 32, 4.4, 1870, true, '2025-11-18', 'hydra-bottle'],
  ['field-cap', 'Field Cap', 'Apparel', 'Sand', 28, 4.3, 404, true, '2026-02-09', 'field-cap'],
  ['carryall-sling', 'Carryall Sling', 'Bags', 'Black', 64, 4.2, 137, false, '2026-07-15', 'carryall-pack'],
  ['volt-trail', 'Volt Trail Runner', 'Outdoor', 'Olive', 149, 3.8, 96, true, '2026-08-11', 'volt-runners'],
  ['field-cap-wool', 'Field Cap, Wool', 'Apparel', 'Navy', 36, 3.9, 58, true, '2026-09-08', 'field-cap'],
  ['hydra-bottle-large', 'Hydra Steel Bottle, 1 L', 'Outdoor', 'Sand', 38, 4.1, 322, true, '2026-06-27', 'hydra-bottle'],
].map(([id, name, category, colour, price, rating, reviews, inStock, added, image]) => ({ id, name, category, colour, price, rating, reviews, inStock, added, image: `/images/${image}.jpg` }));
export const emptyFilters = { categories: [], price: [0, 400], colours: [], inStock: false, rating: 'any' };
export function matches(product, filters, ignoreCategory = false) {
  return (ignoreCategory || !filters.categories.length || filters.categories.includes(product.category))
    && product.price >= filters.price[0] && (filters.price[1] === 400 || product.price <= filters.price[1])
    && (!filters.colours.length || filters.colours.includes(product.colour))
    && (!filters.inStock || product.inStock)
    && product.rating >= (Number(filters.rating) || 0);
}
export function getResults(filters, sort, catalog = products) {
  const results = catalog.filter(product => matches(product, filters));
  if (sort === 'price-asc') results.sort((a, b) => a.price - b.price);
  if (sort === 'price-desc') results.sort((a, b) => b.price - a.price);
  if (sort === 'newest') results.sort((a, b) => b.added.localeCompare(a.added));
  return results;
}
export const toggle = (list, value) => list.includes(value) ? list.filter(item => item !== value) : [...list, value];
