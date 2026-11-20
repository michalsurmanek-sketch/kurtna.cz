import { productURL, statuses } from './catalog.js?v=paths-2';

export const siteURL = 'https://kurtna.cz/';
export const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
}[c]));
export const productCanonical = slug => new URL(productURL(slug), siteURL).href;
export const productFile = slug => productURL(slug).slice(1) + 'index.html';
export const sitemapXML = catalog => '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  [siteURL, ...catalog.filter(p => p.published).map(p => productCanonical(p.slug))]
    .map(url => '  <url><loc>' + escapeHTML(url) + '</loc></url>').join('\n') +
  '\n</urlset>\n';

export function productPage(home, product) {
  const title = product.name + ' | Kurtna.cz';
  const description = product.description || product.name;
  const canonical = productCanonical(product.slug);
  const photo = product.images[0] ? new URL(product.images[0], siteURL).href : '';
  const schema = {
    '@context':'https://schema.org', '@type':'Product', name:product.name,
    description, sku:product.sku, url:canonical,
  };
  if (photo) schema.image = product.images.map(path => new URL(path, siteURL).href);
  const meta = {
    'description':description, 'og:url':canonical, 'og:title':title,
    'og:description':description, 'twitter:title':title, 'twitter:description':description,
  };
  if (photo) Object.assign(meta, {
    'og:image':photo, 'twitter:image':photo,
    'og:image:alt':product.name + ' – ilustrační fotografie',
    'twitter:image:alt':product.name + ' – ilustrační fotografie',
  });
  let html = home.replace('<head>', '<head>\n<base href="/">\n<link rel="canonical" href="' + canonical + '">')
    .replace(/<title>[^<]*<\/title>/, () => '<title>' + escapeHTML(title) + '</title>');
  for (const [key, value] of Object.entries(meta)) {
    const attr = key.startsWith('og:') ? 'property' : 'name';
    const prefix = '<meta ' + attr + '="' + key + '" content="';
    html = html.replace(new RegExp(prefix + '[^"]*">'), () => prefix + escapeHTML(value) + '">');
  }
  if (photo) html = html.replace(/<meta property="og:image:(?:width|height|type)"[^>]*>\n/g, '');
  const detail = `<section class="section product-detail" id="produkt">
  <nav class="detail-path" aria-label="Drobečková navigace"><a href="/#produkty">← Zpět do katalogu</a></nav>
  <article class="detail-grid">
    <div>${photo ? `<img class="detail-photo" src="${escapeHTML(photo)}" alt="${escapeHTML(product.name)} – ilustrační fotografie">` : ''}</div>
    <div class="detail-info">
      <p class="detail-status">${statuses[product.status]}</p>
      <h1>${escapeHTML(product.name)}</h1>
      <p class="detail-description">${escapeHTML(product.description)}</p>
      <dl><dt>Kód produktu</dt><dd>${escapeHTML(product.sku)}</dd><dt>Délka</dt><dd>${product.length} m</dd><dt>Označení varianty</dt><dd>${escapeHTML(product.capacity)}</dd></dl>
      <p class="detail-price">${product.price.toLocaleString('cs-CZ')} Kč <small>orientační cena</small></p>
    </div>
  </article>
</section>`;
  const marker = '<section class="section product-detail" id="produkt" hidden></section>';
  if (!html.includes(marker)) throw new Error('Šablona webu neobsahuje detail produktu.');
  return html
    .replace('</head>', () => '<script type="application/ld+json">' +
      JSON.stringify(schema).replaceAll('<', '\\u003c') + '</script>\n</head>')
    .replace('<body>', '<body class="is-product-page" data-product-slug="' + escapeHTML(product.slug) + '">')
    .replace(marker, () => detail)
    .replace('<link rel="preload" href="assets/hero-ratchet.webp" as="image">\n', '');
}
