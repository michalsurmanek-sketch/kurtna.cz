export const catalogPath = 'catalog.json';
export const statuses = {
  preview: 'Připravujeme',
  available: 'Dostupné k poptání',
  unavailable: 'Dočasně nedostupné',
};
const imagePath = /^assets\/[a-z0-9][a-z0-9._-]*\.(?:webp|png|jpe?g|avif)$/i;
const bounded = (value, max, min = 0) =>
  typeof value === 'string' && value.trim().length >= min && value.length <= max;

export function validateCatalog(products) {
  if (!Array.isArray(products) || products.length > 200) throw new Error('Katalog může obsahovat nejvýše 200 produktů.');
  const ids = new Set();
  const slugs = new Set();
  const skus = new Set();
  for (const p of products) {
    if (!p || !Number.isSafeInteger(p.id) || p.id < 1 || ids.has(p.id) ||
        !bounded(p.slug, 100, 1) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug) || slugs.has(p.slug) ||
        !bounded(p.sku, 40, 1) || skus.has(p.sku.toUpperCase()) ||
        !bounded(p.name, 140, 1) || !bounded(p.label, 70, 1) || !bounded(p.description, 1800) ||
        !bounded(p.capacity, 24, 1) || !Number.isFinite(p.length) || p.length <= 0 || p.length > 1000 ||
        !Number.isSafeInteger(p.price) || p.price < 1 || p.price > 1000000 ||
        !Object.hasOwn(statuses, p.status) || typeof p.published !== 'boolean' ||
        !Array.isArray(p.images) || p.images.length > 6 || p.images.some(path => typeof path !== 'string' || !imagePath.test(path))) {
      throw new Error('Neplatný produkt nebo duplicitní kód/SKU či adresa: ' + (p?.name || 'bez názvu'));
    }
    ids.add(p.id);
    slugs.add(p.slug);
    skus.add(p.sku.toUpperCase());
  }
  return products;
}

export async function loadCatalog() {
  const response = await fetch(new URL(catalogPath, import.meta.url), {cache: 'no-cache'});
  if (!response.ok) throw new Error('Katalog se nepodařilo načíst.');
  return validateCatalog(await response.json());
}

export const assetURL = path => new URL(path, import.meta.url).href;
export const productURL = slug => './?produkt=' + encodeURIComponent(slug);
