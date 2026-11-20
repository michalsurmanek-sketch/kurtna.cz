import { catalogPath, productURL, statuses, validateCatalog } from './catalog.js?v=paths-2';
import { productFile, productPage, sitemapXML } from './product-pages.js?v=2';

const repository = 'michalsurmanek-sketch/kurtna.cz';
const api = 'https://api.github.com';
const repoEndpoint = api + '/repos/' + repository;
const branch = 'main';
const $ = selector => document.querySelector(selector);
const editor = $('#editor');
const publisher = $('#publisher');
const status = $('#status');
const publication = $('#publication');
const tokenInput = $('#github-token');
const publishButton = $('#publish');
const labels = ['name','label','sku','slug','capacity','length','price','status','description','images','published'];
let products = [];
let baseSHA;
let baseProducts = [];
let selected;
let pending = false;
let editing = false;
let busy = false;

function updateButtons() {
  publishButton.disabled = busy || !pending || editing;
  $('#new-product').disabled = busy;
  editor.querySelectorAll('input, textarea, select, button').forEach(field => { field.disabled = busy; });
}

function showList() {
  $('#products').replaceChildren(...products.map(p => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    const note = document.createElement('small');
    button.type = 'button';
    button.textContent = p.label;
    button.disabled = busy;
    button.setAttribute('aria-current', String(p.id === selected));
    note.textContent = p.published ? statuses[p.status] : 'Skrytý';
    button.append(note);
    button.addEventListener('click', () => {
      if (!editing || confirm('Zahodit změny v otevřeném formuláři?')) openProduct(p);
    });
    item.append(button);
    return item;
  }));
}

function openProduct(p) {
  selected = p?.id;
  editor.reset();
  for (const key of labels) {
    const field = editor.elements.namedItem(key);
    if (key === 'published') field.checked = p?.published ?? false;
    else if (key === 'images') field.value = p?.images.join('\n') || '';
    else if (key === 'status') field.value = p?.status || 'preview';
    else field.value = p?.[key] ?? '';
  }
  $('#editor-title').textContent = p ? p.name : 'Nový produkt';
  const link = $('#preview-link');
  link.hidden = !p?.published;
  if (p?.published) link.href = productURL(p.slug);
  editing = false;
  updateButtons();
  showList();
}

editor.addEventListener('input', () => {
  editing = true;
  updateButtons();
});
$('#new-product').onclick = () => {
  if (!editing || confirm('Zahodit změny v otevřeném formuláři?')) {
    openProduct();
    editor.elements.namedItem('name').focus();
  }
};

editor.addEventListener('submit', event => {
  event.preventDefault();
  if (busy) return;
  const form = new FormData(editor);
  const item = {id: selected ?? Math.max(0, ...products.map(p => p.id)) + 1};
  for (const key of labels) {
    const value = String(form.get(key) ?? '').trim();
    if (key === 'published') item[key] = form.has(key);
    else if (key === 'images') item[key] = value.split(/\r?\n/).map(path => path.trim()).filter(Boolean);
    else if (['price','length'].includes(key)) item[key] = Number(value);
    else item[key] = value;
  }
  const next = selected ? products.map(p => p.id === selected ? item : p) : [...products, item];
  try {
    products = validateCatalog(next);
    pending = true;
    openProduct(item);
    status.textContent = 'Produkt je připravený k publikaci. Změny ještě nejsou na webu.';
  } catch (error) {
    status.textContent = error.message;
  }
});

async function github(url, token, payload) {
  const headers = {Accept:'application/vnd.github+json'};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (payload) headers['Content-Type'] = 'application/json';
  const response = await fetch(url, {
    method: payload ? 'POST' : 'GET',
    headers, body: payload ? JSON.stringify(payload) : undefined,
    cache: 'no-store', credentials: 'omit', redirect: 'error',
  });
  if (!response.ok) {
    if ([401,403,404].includes(response.status) && token) {
      throw new Error('GitHub odmítl přístup. Ověřte token, repozitář a oprávnění Contents: Read and write.');
    }
    throw new Error('GitHub vrátil chybu ' + response.status + '.');
  }
  return response.json();
}
const githubFile = (path, ref, token) =>
  github(repoEndpoint + '/contents/' + path + '?ref=' + encodeURIComponent(ref), token);

async function publishCatalog(token) {
  const ref = await github(repoEndpoint + '/git/ref/heads/' + branch, token);
  const head = ref.object.sha;
  const [current, homeFile] = await Promise.all([
    githubFile(catalogPath, head, token),
    githubFile('index.html', head, token),
  ]);
  if (current.sha !== baseSHA) {
    throw new Error('Katalog se na GitHubu mezitím změnil. Uložte si rozpracované údaje a znovu načtěte editor.');
  }
  const draft = JSON.stringify(products, null, 2) + '\n';
  const home = decode(homeFile.content);
  const visible = products.filter(p => p.published);
  const previous = new Map(baseProducts.filter(p => p.published).map(p => [p.slug, p]));
  const publicSlugs = new Set(visible.map(p => p.slug));
  const additions = [
    {path:catalogPath, contents:encode(draft)},
    {path:'sitemap.xml', contents:encode(sitemapXML(products))},
    ...visible.filter(p => JSON.stringify(p) !== JSON.stringify(previous.get(p.slug))).map(p => ({
      path:productFile(p.slug), contents:encode(productPage(home,p)),
    })),
  ];
  const deletions = [...previous.keys()].filter(slug => !publicSlugs.has(slug))
    .map(slug => ({path:productFile(slug)}));
  const query = `mutation PublishCatalog($input: CreateCommitOnBranchInput!) {
    createCommitOnBranch(input: $input) { commit { oid } }
  }`;
  const result = await github(api + '/graphql', token, {query, variables:{input:{
    branch: {repositoryNameWithOwner:repository, branchName:branch},
    expectedHeadOid:head,
    message: {headline:'Aktualizace katalogu Kurtna.cz'},
    fileChanges: {additions, deletions},
  }}});
  if (!result.data?.createCommitOnBranch?.commit?.oid) {
    throw new Error('GitHub změny neuložil. Zkontrolujte oprávnění tokenu, pravidla větve a aktuální verzi katalogu.');
  }
  baseProducts = products;
  baseSHA = await gitBlobSHA(new TextEncoder().encode(draft));
}

function decode(content) {
  const bytes = Uint8Array.from(atob(content.replace(/\s/g,'')), char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
function encode(data) {
  const bytes = new TextEncoder().encode(data);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function gitBlobSHA(bytes) {
  const header = new TextEncoder().encode('blob ' + bytes.length + '\0');
  const combined = new Uint8Array(header.length + bytes.length);
  combined.set(header);
  combined.set(bytes, header.length);
  const digest = await crypto.subtle.digest('SHA-1', combined);
  return [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2,'0')).join('');
}

function openCatalog(raw, sha, message) {
  products = validateCatalog(JSON.parse(raw));
  baseSHA = sha;
  baseProducts = products;
  $('#workspace').hidden = false;
  openProduct(products[0]);
  status.textContent = message + ' Produktů: ' + products.length + '.';
}

try {
  const data = await githubFile(catalogPath, branch);
  openCatalog(decode(data.content), data.sha, 'Katalog načten z GitHubu.');
} catch {
  try {
    const response = await fetch(catalogPath, {cache:'no-cache'});
    if (!response.ok) throw new Error();
    const bytes = new Uint8Array(await response.arrayBuffer());
    const sha = await gitBlobSHA(bytes);
    openCatalog(new TextDecoder().decode(bytes), sha, 'Načtená je aktuálně nasazená verze.');
  } catch {
    status.textContent = 'Katalog nelze načíst. Obnovte stránku a zkuste to znovu.';
  }
}

publisher.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !pending || editing || !baseSHA) return;
  const token = tokenInput.value.trim();
  if (!token) return;
  tokenInput.value = '';
  tokenInput.disabled = true;
  busy = true;
  updateButtons();
  showList();
  publication.textContent = 'Publikuji změny do GitHubu…';
  try {
    await publishCatalog(token);
    pending = false;
    status.textContent = 'Katalog uložen do GitHubu.';
    publication.textContent = 'GitHub uložil katalog, detaily a mapu webu. Zobrazí se po dokončení nasazení.';
  } catch (error) {
    publication.textContent = error.message;
  } finally {
    tokenInput.disabled = false;
    busy = false;
    updateButtons();
    showList();
  }
});

window.addEventListener('beforeunload', event => {
  if (pending || editing) {
    event.preventDefault();
    event.returnValue = true;
  }
});
