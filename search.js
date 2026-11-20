import {assetURL, productURL} from './catalog.js?v=paths-2';

const CZK = new Intl.NumberFormat('cs-CZ',{style:'currency',currency:'CZK',maximumFractionDigits:0});
const advice = [
  {title:'Jakou délku kurtny vybrat?', text:'Změřte trasu pásu mezi kotevními body.', path:'delka', terms:'délka metr metry m dlouhou krátkou přívěs vozík'},
  {title:'Jak vybrat háky a umístit ráčnu?', text:'Ověřte, že háky pasují do kotevních bodů.', path:'uchyceni', terms:'háky háček ráčna přívěs vozík auto motorka uchycení příslušenství'},
  {title:'Co znamenají LC a STF?', text:'Naučte se číst údaje na štítku pásu.', path:'stitek', terms:'nosnost síla lc stf dan štítek tun t těžký heavy duty'},
  {title:'Kontrola kurtny před použitím', text:'Zkontrolujte popruh, švy, ráčnu a háky.', path:'kontrola', terms:'kontrola poškozená bezpečnost opotřebení použití'},
];

function normalize(value) {
  return value.toLocaleLowerCase('cs').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/(\d)\s*,\s*(\d)/g,'$1.$2')
    .replace(/(\d)(?=[a-z])/g,'$1 ');
}
function tokens(value) {
  return normalize(value).match(/\d+(?:\.\d+)?|[a-z]+/g) ?? [];
}

const aliases = [
  [/^(kurtn\w*|kurt\w*|upinac\w*|pas(?:y|u|em|ech)?|popruh\w*|gurt\w*)$/, 'kurtna'],
  [/^(hac\w*|hak\w*)$/, 'hak'],
  [/^racn\w*$/, 'racna'],
  [/^(t|tun\w*)$/, 't'],
  [/^(m|metr\w*)$/, 'm'],
];
const stopWords = new Set(['na','do','pro','s','za','jak','vybrat','co','je','kde']);
function queryTokens(value) {
  return tokens(value).filter(term => !stopWords.has(term))
    .map(term => aliases.find(([pattern]) => pattern.test(term))?.[1] ?? term)
    .filter((word,i,all) => i === 0 || word !== all[i-1]);
}

// One insertion, deletion, substitution or adjacent transposition.
function nearMatch(a,b) {
  if (a.length < 4 || Math.abs(a.length-b.length)>1 || !/^[a-z]+$/.test(a+b)) return false;
  if (a.length>b.length) [a,b]=[b,a];
  let i=0,j=0,edits=0;
  while (i<a.length && j<b.length) {
    if (a[i]===b[j]) { i++;j++;continue; }
    if (++edits>1) return false;
    if (a.length===b.length) {
      if (a[i]===b[j+1] && a[i+1]===b[j]) {i+=2;j+=2;continue;}
      i++;
    }
    j++;
  }
  return edits+(a.length-i)+(b.length-j)<=1;
}

function termScore(term, words) {
  if (words.includes(term)) return 5;
  if (term.length>=2 && /[a-z]/.test(term) && words.some(word=>word.startsWith(term))) return 3;
  if (words.some(word=>nearMatch(term,word))) return 1;
  return 0;
}

function productScore(query, product) {
  const terms = queryTokens(query);
  const words = queryTokens([product.name,product.sku,product.label,product.description,product.capacity,product.length+' m'].join(' '));
  let score=0;
  for(let i=0;i<terms.length;i++){
    const term=terms[i];
    const unit=terms[i+1];
    if (/^\d+(?:\.\d+)?$/.test(term) && (unit==='t' || unit==='m')) {
      const value=unit==='t'?tokens(product.capacity)[0]:String(product.length);
      if (Number(term)!==Number(value)) return -1;
      i++;
      score+=8;
      continue;
    }
    const match=termScore(term,words);
    if (!match) return -1;
    score+=match;
  }
  if (query.trim() && normalize(product.sku)===normalize(query.trim())) score+=20;
  return score;
}
export const matchesProduct = (query,product) => productScore(query,product)>=0;
function resultsFor(query,products) {
  const ranked = products.map(product=>({product,score:productScore(query,product)}))
    .filter(result=>result.score>=0)
    .sort((a,b)=>b.score-a.score || a.product.id-b.product.id);
  const result = ranked.slice(0,query.trim()?5:3).map(({product})=>({
    title:product.name, side:CZK.format(product.price), url:productURL(product.slug),
    text:product.status==='unavailable'?'Dočasně nedostupné':'Orientační cena · '+product.sku,
    image:product.images[0] ? assetURL(product.images[0]) : '',
  }));
  const terms = queryTokens(query);
  const topics=advice.map(topic=>({
    topic, score:terms.reduce((sum,term)=>sum+termScore(term,queryTokens(topic.title+' '+topic.terms)),0),
  })).sort((a,b)=>b.score-a.score);
  const best=topics.filter(item=>item.score>0).slice(0,2).map(item=>item.topic);
  if (!best.length) best.push(advice[0]);
  result.push(...best.map(topic=>({...topic,url:'/poradna/#'+topic.path,tip:true})));
  return {items:result, productCount:ranked.length};
}

function element(tag,className,text) {
  const node=document.createElement(tag);
  node.className=className;
  if (text) node.textContent=text;
  return node;
}

export function installSearchSuggestions(input, mount, products, onSubmit) {
  const panel=element('div','search-suggestions');
  const hint=element('p','suggestions-label');
  const list=element('div','suggestions-list');
  const live=element('span','search-sr-only');
  list.id=input.id+'-suggestions';
  list.setAttribute('role','listbox');
  list.setAttribute('aria-label','Návrhy vyhledávání');
  live.setAttribute('role','status');
  panel.append(hint,list);
  mount.append(panel,live);
  input.setAttribute('autocomplete','off');
  input.setAttribute('role','combobox');
  input.setAttribute('aria-autocomplete','list');
  input.setAttribute('aria-controls',list.id);
  let items=[],active=-1;

  function close() {
    panel.hidden=true;
    active=-1;
    input.setAttribute('aria-expanded','false');
    input.removeAttribute('aria-activedescendant');
  }

  function open() {
    const query=input.value;
    const result=resultsFor(query,products);
    items=result.items;
    active=-1;
    input.removeAttribute('aria-activedescendant');
    hint.textContent=!query.trim()?'Oblíbené produkty a rady':result.productCount?'Nalezené produkty a rady':'Žádný odpovídající produkt. Zkuste radu níže.';
    live.textContent=result.productCount+' produktů a '+items.filter(item=>item.tip).length+' rad.';
    list.replaceChildren(...items.map((item,index)=>{
      const row=element('div','suggestion-row');
      row.id=list.id+'-'+index;
      row.setAttribute('role','option');
      row.setAttribute('aria-selected','false');
      if (item.image) {
        const image=element('img','suggestion-photo');
        image.src=item.image;
        image.alt='';
        image.width=52;
        image.height=42;
        row.append(image);
      } else row.append(element('span','suggestion-symbol',item.tip?'?':'↗'));
      const copy=element('span','suggestion-copy');
      copy.append(element('strong','suggestion-title',item.title),element('small','suggestion-caption',item.tip?'Poradna · '+item.text:item.text));
      row.append(copy,element('span','suggestion-side',item.side || '→'));
      row.addEventListener('mousedown', event=>event.preventDefault());
      row.addEventListener('click',()=>location.assign(item.url));
      return row;
    }));
    panel.hidden=false;
    input.setAttribute('aria-expanded','true');
  }

  input.addEventListener('focus',open);
  input.addEventListener('input',event=>{if(!event.isComposing)open();});
  input.addEventListener('compositionend',open);
  input.addEventListener('blur',event=>{if(event.relatedTarget && !mount.contains(event.relatedTarget))close();});
  document.addEventListener('pointerdown',event=>{if(!mount.contains(event.target))close();});

  input.addEventListener('keydown',event=>{
    if (event.isComposing) return;
    if (event.key==='Tab') {close();return;}
    if (event.key==='Escape' && !panel.hidden) {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key==='Enter') {
      event.preventDefault();
      if (!panel.hidden && active>=0) location.assign(items[active].url);
      else {close();onSubmit();}
      return;
    }
    if (!['ArrowDown','ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    if (panel.hidden) open();
    active=(active<0 && event.key==='ArrowUp')?items.length-1:
      (active+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
    const row=list.children[active];
    [...list.children].forEach(node=>node.setAttribute('aria-selected',String(node===row)));
    input.setAttribute('aria-activedescendant',row.id);
    row.scrollIntoView({block:'nearest'});
  });

  close();
  return {close};
}
