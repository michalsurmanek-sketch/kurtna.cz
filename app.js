'use strict';
import { assetURL, loadCatalog, productURL, statuses } from './catalog.js?v=paths-2';
let products = [];
let catalogLoaded = false;
try {
  products = (await loadCatalog()).filter(p => p.published);
  catalogLoaded = true;
} catch {
  document.querySelector('.products').textContent = 'Katalog se nepodařilo načíst. Zkuste obnovit stránku.';
}
const quoteable = p => p.status !== 'unavailable';
const escapeHTML = text => String(text).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const $=s=>document.querySelector(s),money=n=>new Intl.NumberFormat('cs-CZ',{style:'currency',currency:'CZK',maximumFractionDigits:0}).format(n);
let cart={};try{const saved=JSON.parse(localStorage.getItem('kurtna-cart')||'{}');for(const p of products.filter(quoteable))if(Number.isInteger(saved[p.id])&&saved[p.id]>0)cart[p.id]=Math.min(99,saved[p.id]);}catch{}
function save(){try{localStorage.setItem('kurtna-cart',JSON.stringify(cart));}catch{ping('Ukládání v tomto prohlížeči není dostupné.');}$('#count').textContent=Object.values(cart).reduce((a,b)=>a+b,0);}
function ping(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(window.timer);window.timer=setTimeout(()=>$('#toast').classList.remove('show'),2200);}
const modal=$('#modal'),body=$('#modal-body');modal.querySelector('.close').onclick=()=>modal.close();modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)modal.close();}});
function show(html){body.innerHTML=html;if(!modal.open)modal.showModal();}
function add(id){if (!products.some(p => p.id === id && quoteable(p))) return;cart[id]=Math.min(99,(cart[id]||0)+1);save();ping('Přidáno do košíku');}
const cartIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 3h3l3 13h11l3-10H6"/><circle cx="10" cy="21" r="1"/><circle cx="19" cy="21" r="1"/></svg>';
const productGrid = $('.products');
const cards = new Map();
const normalize = value => value.toLocaleLowerCase('cs').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

for (const p of products) {
  const card = document.createElement('article');
  card.className = 'product';
  const href = productURL(p.slug);
  const photo = p.images[0]
    ? `<img src="${assetURL(p.images[0])}" alt="" width="660" height="440" decoding="async">`
    : '<span class="image-placeholder">Bez fotografie</span>';
  card.innerHTML = `<a class="photo product-photo-link" href="${href}" aria-label="Detail: ${escapeHTML(p.name)}">${photo}</a>
    <div class="info"><strong><a href="${href}"><span class="product-type">Upínací pás (kurtna)</span>${escapeHTML(p.label)}</a></strong>
    <div class="price">${money(p.price)}</div><button class="add" aria-label="Přidat do košíku" ${quoteable(p) ? '' : 'disabled'}>${cartIcon}</button></div>`;
  card.querySelector('.add').onclick = () => add(p.id);
  cards.set(p.id, card);
}
const appendOptions = (select, values, label) => {
  for (const value of values) select.add(new Option(label(value), value));
};
appendOptions($('#capacity'), [...new Set(products.map(p => p.capacity))].sort((a,b) => a.localeCompare(b, 'cs', {numeric:true})), String);
appendOptions($('#length'), [...new Set(products.map(p => p.length))].sort((a,b) => a-b), n => n + ' m');

function filter() {
  if (!catalogLoaded) return;
  const query = normalize($('#mobile-search').value.trim());
  const capacity = $('#capacity').value;
  const length = $('#length').value;
  const order = $('#sort').value;
  const sorted = [...products].sort((a,b) => order === 'asc' ? a.price-b.price : order === 'desc' ? b.price-a.price : a.id-b.id);
  let count = 0;
  for (const p of sorted) {
    const card = cards.get(p.id);
    card.hidden = !(normalize([p.name, p.sku, p.label].join(' ')).includes(query) &&
      (!capacity || p.capacity === capacity) && (!length || p.length === Number(length)));
    if (!card.hidden) count++;
    productGrid.append(card);
  }
  $('#results').textContent = count ? 'Počet produktů: ' + count : 'Žádné produkty neodpovídají výběru.';
}
$('#search').oninput = e => { $('#mobile-search').value = e.target.value; filter(); };
$('#mobile-search').oninput = e => { $('#search').value = e.target.value; filter(); };
for (const id of ['capacity','length','sort']) $('#' + id).onchange = filter;
$('#reset').onclick = () => {
  for (const id of ['search','mobile-search','capacity','length']) $('#' + id).value = '';
  $('#sort').value = 'default';
  filter();
};
for (const [selector, field] of [['.category--use','mobile-search'],['.category--capacity','capacity'],['.category--length','length']]) {
  $(selector).addEventListener('click', () => {
    $('.catalog-controls').open = true;
    $('#' + field).focus({preventScroll:true});
  });
}

const canonicalBase = 'https://kurtna.cz/';
function setCanonical(url) {
  const link = document.createElement('link');
  link.rel = 'canonical';
  link.href = url;
  document.head.append(link);
}
function setProductSEO(p) {
  const url = new URL(productURL(p.slug), canonicalBase).href;
  const title = p.name + ' | Kurtna.cz';
  const description = p.description || p.name;
  document.title = title;
  setCanonical(url);
  const updateMeta = (key, content) => {
    const attribute = key.startsWith('og:') ? 'property' : 'name';
    document.querySelector(`meta[${attribute}="${key}"]`).content = content;
  };
  for (const key of ['description','og:description','twitter:description']) updateMeta(key, description);
  for (const key of ['og:title','twitter:title']) updateMeta(key, title);
  updateMeta('og:url', url);
  const data = {'@context':'https://schema.org','@type':'Product',name:p.name,description,sku:p.sku,url};
  if (p.images.length) {
    data.image = p.images.map(path => new URL(path, canonicalBase).href);
    for (const key of ['og:image','twitter:image']) updateMeta(key, data.image[0]);
    for (const key of ['og:image:alt','twitter:image:alt']) updateMeta(key, p.name + ' – ilustrační fotografie');
    for (const suffix of ['type','width','height']) document.querySelector(`meta[property="og:image:${suffix}"]`).remove();
  }
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(data);
  document.head.append(script);
}

function renderDetail() {
  const staticSlug = document.body.dataset.productSlug;
  const slug = staticSlug || new URLSearchParams(location.search).get('produkt');
  if (slug === null) {
    setCanonical(canonicalBase);
    return;
  }
  document.body.classList.add('is-product-page');
  const target = $('#produkt');
  target.hidden = false;
  const p = products.find(product => product.slug === slug);
  if (!p) {
    if (staticSlug && !catalogLoaded) return;
    if (catalogLoaded) {
      const robots = document.createElement('meta');
      robots.name = 'robots';
      robots.content = 'noindex';
      document.head.append(robots);
      document.title = 'Produkt nenalezen | Kurtna.cz';
    }
    target.innerHTML = '<h1>Produkt se nepodařilo zobrazit</h1><p><a href="./#produkty">Zpět do katalogu</a></p>';
    return;
  }
  if (!staticSlug) setProductSEO(p);
  target.innerHTML = `<nav class="detail-path" aria-label="Drobečková navigace"><a href="./#produkty">← Zpět do katalogu</a></nav>
    <article class="detail-grid">
      <div>
        ${p.images.length ? `<img class="detail-photo" src="${assetURL(p.images[0])}" alt="${escapeHTML(p.name)} – ilustrační fotografie">` : '<p class="image-placeholder">Bez fotografie</p>'}
        <div class="detail-gallery">${p.images.length > 1 ? p.images.map((path, index) => `<button type="button" aria-label="Fotografie ${index+1}" aria-pressed="${index===0}"><img src="${assetURL(path)}" alt=""></button>`).join('') : ''}</div>
      </div>
      <div class="detail-info">
        <p class="detail-status">${statuses[p.status]}</p><h1>${escapeHTML(p.name)}</h1>
        <p class="detail-description">${escapeHTML(p.description)}</p>
        <dl><dt>Kód produktu</dt><dd>${escapeHTML(p.sku)}</dd><dt>Délka</dt><dd>${p.length.toLocaleString('cs-CZ')} m</dd><dt>Označení varianty</dt><dd>${escapeHTML(p.capacity)}</dd></dl>
        <p class="detail-price">${money(p.price)} <small>orientační cena</small></p>
        ${quoteable(p) ? '<button class="action" id="detail-add">Přidat do poptávky</button>' : '<p>Tuto variantu teď nelze poptat.</p>'}
        <p class="detail-note">Fotografie je ilustrační. Technické údaje a dostupnost podléhají potvrzení dodavatelem.</p>
      </div>
    </article>`;
  const buttons = target.querySelectorAll('.detail-gallery button');
  buttons.forEach((button, index) => button.addEventListener('click', () => {
    target.querySelector('.detail-photo').src = assetURL(p.images[index]);
    buttons.forEach(other => other.setAttribute('aria-pressed', String(other === button)));
  }));
  $('#detail-add')?.addEventListener('click', () => add(p.id));
}
renderDetail();
function total(){return products.reduce((sum,p)=>sum+p.price*(cart[p.id]||0),0);}
function renderCart(){const chosen=products.filter(p=>cart[p.id]);show(`<h2>Váš košík</h2>${chosen.length?chosen.map(p=>`<div class="cart-row"><span>${escapeHTML(p.name)}<br>${money(p.price)}</span><button data-id="${p.id}" data-change="-1" aria-label="Ubrat ${escapeHTML(p.name)}">−</button><b>${cart[p.id]}</b><button data-id="${p.id}" data-change="1" aria-label="Přidat ${escapeHTML(p.name)}">+</button><button data-id="${p.id}" data-change="remove" aria-label="Odstranit ${escapeHTML(p.name)}">✕</button></div>`).join('')+`<h3>Orientačně ${money(total())}</h3><p>Doprava není započtena. Nejde o závaznou nabídku.</p><button class="action" id="checkout">Připravit poptávku</button>`:'<p class="empty">Košík je prázdný. Vyberte si produkty v katalogu.</p>'}`);body.querySelectorAll('[data-change]').forEach(b=>b.onclick=()=>{const id=+b.dataset.id;cart[id]=b.dataset.change==='remove'?0:Math.min(99,cart[id]+Number(b.dataset.change));if(!cart[id])delete cart[id];save();renderCart();});if($('#checkout'))$('#checkout').onclick=checkout;}
$('.cart').onclick=renderCart;
function checkout(){show(`<h2>Připravit poptávku</h2><p>Poptávka se stáhne jako textový soubor. Nikam se neodesílá, nevytváří objednávku a nevyžaduje platbu. Kontaktní údaje se neukládají.</p><form class="checkout"><label>Jméno<input name="name" autocomplete="name" required maxlength="100"></label><label>E-mail<input name="email" type="email" autocomplete="email" required maxlength="150"></label><label>Poznámka<textarea name="note" maxlength="2000"></textarea></label><button class="action" type="submit">Stáhnout podklady poptávky</button><button type="button" id="back-cart">Zpět do košíku</button></form>`);$('#back-cart').onclick=renderCart;body.querySelector('form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);const text=['KURTNA.CZ – NEODESLANÁ POPTÁVKA',`Datum: ${new Date().toLocaleDateString('cs-CZ')}`,`Jméno: ${f.get('name')}`,`E-mail: ${f.get('email')}`,'',...products.filter(p=>cart[p.id]).map(p=>`${p.name}: ${cart[p.id]} ks × ${money(p.price)}`),`Orientační součet bez dopravy: ${money(total())}`,'',`Poznámka: ${f.get('note')}`,'','Ceny a parametry jsou ilustrační. Toto není objednávka ani potvrzení dostupnosti.'].join('\n');const url=URL.createObjectURL(new Blob(['\ufeff'+text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='kurtna-poptavka.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);ping('Podklady připraveny ke stažení. Poptávka nebyla odeslána.');};}
$('#menu').setAttribute('aria-expanded','false');$('#menu').onclick=()=>{const n=$('.header nav'),open=$('#menu').getAttribute('aria-expanded')==='true';$('#menu').setAttribute('aria-expanded',String(!open));n.style.cssText=open?'':'display:flex;position:absolute;top:62px;left:0;right:0;padding:18px;background:#171819;flex-direction:column;z-index:8';};document.querySelectorAll('.header nav a').forEach(a=>a.onclick=()=>{$('.header nav').style.cssText='';$('#menu').setAttribute('aria-expanded','false');});if (products.length) save(); else $('#count').textContent = 0;filter();
