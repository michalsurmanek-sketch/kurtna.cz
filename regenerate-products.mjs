import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { productFile, productPage, sitemapXML } from './product-pages.js';

const project = new URL('./', import.meta.url);
const fromProject = path => new URL(path, project);
const home = await readFile(fromProject('index.html'), 'utf8');
const catalog = JSON.parse(await readFile(fromProject('catalog.json'), 'utf8'));

for (const product of catalog.filter(p => p.published)) {
  const file = fromProject(productFile(product.slug));
  await mkdir(new URL('.', file), {recursive:true});
  await writeFile(file, productPage(home, product));
}
await writeFile(fromProject('sitemap.xml'), sitemapXML(catalog));
