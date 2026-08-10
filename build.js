#!/usr/bin/env node
/* build.js — ensambla index.html a partir de los .tid en tiddlers/
   Motor mínimo con navegación por categorías + vista tipo wiki.
   Dependencias: ninguna (Node built-in). */
const fs = require('fs');
const path = require('path');


const ROOT = __dirname;
const TID_DIR = path.join(ROOT, 'tiddlers');
const OUT = path.join(ROOT, 'index.html');

// Categorías base (orden de menú). Se añade "Otros" si un artículo no encaja.
// Enfoque: PREPARACIONISMO para eventos (Inundación, Fuego, Nevadas, Virus/Confinamiento)
// + temas transversales (Agua, Alimentación, Salud, Comunicaciones, Documentación, Energía/luz, Herramientas).
const CATEGORIES = ['Inundación','Fuego','Nevadas','Virus/Confinamiento','Apagón','Agua','Alimentación','Salud','Comunicaciones','Documentación','Energía/luz','Herramientas'];
// Icono por categoría (emoji)
const CAT_ICON = {
  'Inundación': '🌊',
  'Fuego': '🔥',
  'Nevadas': '❄️',
  'Virus/Confinamiento': '🦠',
  'Apagón': '🔌',
  'Agua': '💧',
  'Alimentación': '🥫',
  'Salud': '⚕️',
  'Comunicaciones': '📡',
  'Documentación': '📄',
  'Energía/luz': '🔦',
  'Herramientas': '🛠️',
  'Otros': '📦',
};

function parseTid(raw) {
  const lines = raw.split('\n');
  const meta = {};
  let i = 0;
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (l === '') { i++; break; }
    const m = l.match(/^([A-Za-z0-9_]+):\s?(.*)$/);
    if (m) meta[m[1]] = m[2];
  }
  const body = lines.slice(i).join('\n').trim();
  return { meta, body };
}

function wiki2html(body) {
  let h = body
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/\[\[([^\]]+)\]\]/g, '<a href="#">$1</a>')
    .replace(/'''([^']+)'''/g, '<b>$1</b>')
    .replace(/''([^']+)''/g, '<i>$1</i>');
  const blocks = h.split('\n');
  let out = '', inList = false;
  for (let line of blocks) {
    if (line.startsWith('! ')) { if(inList){out+='</ul>';inList=false;} out += `<h1>${line.slice(2)}</h1>`; }
    else if (line.startsWith('!! ')) { if(inList){out+='</ul>';inList=false;} out += `<h2>${line.slice(3)}</h2>`; }
    else if (line.startsWith('# ')) { if(!inList){out+='<ol>';inList='ol';} out += `<li>${line.slice(2)}</li>`; }
    else if (line.startsWith('* ')) { if(!inList){out+='<ul>';inList='ul';} out += `<li>${line.slice(2)}</li>`; }
    else { if(inList){out+=`</${inList}>`;inList=false;} if(line.trim()) out += `<p>${line}</p>`; }
  }
  if (inList) out += `</${inList}>`;
  return out;
}

function extractRawHtml(body) {
  const m = body.match(/<html>([\s\S]*?)<\/html>/);
  return m ? m[1] : '';
}

function build() {
  const files = fs.readdirSync(TID_DIR).filter(f => f.endsWith('.tid'));
  const tiddlers = files.map(f => {
    const raw = fs.readFileSync(path.join(TID_DIR, f), 'utf8');
    return parseTid(raw);
  });

  // Página de inicio = tiddler con tag "Portada" (si no, el primero)
  const home = tiddlers.find(t => (t.meta.tags || '').split(' ').includes('Portada')) || tiddlers[0];
  const homeId = encodeURIComponent(home.meta.title);

  // Agrupar artículos por categoría (todas las etiquetas que sean categorías base)
  const groups = {};
  CATEGORIES.forEach(c => groups[c] = []);
  groups['Otros'] = [];
  const articles = tiddlers.filter(t => t !== home);
  for (const t of articles) {
    const tags = (t.meta.tags || '').split(' ').filter(Boolean);
    const cats = tags.filter(tg => CATEGORIES.includes(tg));
    if (cats.length === 0) groups['Otros'].push(t);
    else cats.forEach(c => groups[c].push(t));
  }

  // Secciones de artículos
  const entries = tiddlers.map(t => {
    const title = t.meta.title || 'Sin título';
    const id = encodeURIComponent(title);
    const tags = (t.meta.tags || '').split(' ').filter(Boolean);
    const tagHtml = tags.map(tg => `<span class="tag">${tg}</span>`).join(' ');
    const htmlBody = wiki2html(t.body).replace(/<html>[\s\S]*?<\/html>/g, '');
    const rawHtml = extractRawHtml(t.body);
    return `
<section class="view card tiddler" id="${id}">
  <h2>${title}</h2>
  <div class="tags">${tagHtml}</div>
  <div class="body">${htmlBody}${rawHtml}</div>
</section>`;
  }).join('\n');

  // Secciones de categoría (páginas con enlaces a sus artículos)
  const catSections = CATEGORIES.concat(['Otros']).filter(c => groups[c].length).map(c => {
    const links = groups[c].map(t =>
      `<li><a href="#" onclick="show('${encodeURIComponent(t.meta.title)}')">${t.meta.title}</a></li>`).join('\n');
    const cid = 'cat-' + encodeURIComponent(c);
    return `<section class="view" id="${cid}">
  <h2>${CAT_ICON[c]||''} ${c}</h2>
  <p class="catdesc">Artículos en la categoría <b>${c}</b>:</p>
  <ul class="catlist">${links}</ul>
</section>`;
  }).join('\n');

  // Menú: Inicio + categorías
  const navCats = CATEGORIES.concat(['Otros']).filter(c => groups[c].length)
    .map(c => `<li><a href="#" data-cat="${c}" onclick="show('cat-${encodeURIComponent(c)}')">${CAT_ICON[c]||''} ${c}</a></li>`).join('\n');
  const nav = `<li><a href="#" onclick="show('${homeId}')"><b>🏠 Inicio</b></a></li>\n${navCats}`;
  const pillsHtml = CATEGORIES.concat(['Otros']).filter(c => groups[c].length)
    .map(c => `<div class="pill" data-cat="${c}" onclick="show('cat-${encodeURIComponent(c)}')">${CAT_ICON[c]||''} ${c}</div>`).join('\n');

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wiki Preparacionismo</title>
<style>
  :root{ --bg:#faf6f0; --ink:#3a332b; --muted:#8a7d6d; --accent:#c9744e; --card:#fffdf9; --line:#ece2d4; }
  *{box-sizing:border-box}
  body{margin:0;font-family:'Iowan Old Style',Palatino,Georgia,serif;background:var(--bg);color:var(--ink)}
  header{background:var(--bg);border-bottom:2px solid var(--ink);padding:1.3rem 2rem 1.1rem;display:flex;flex-direction:column;gap:.9rem}
  .topbar{display:flex;align-items:center;justify-content:space-between}
  .brand{font-size:1.6rem;font-weight:700;letter-spacing:.5px}
  .brand span{color:var(--accent)}
  .actions button{background:var(--accent);color:#fff;border:none;border-radius:20px;padding:.5rem 1rem;font-size:.8rem;cursor:pointer;font-family:system-ui,sans-serif;margin-left:.4rem}
  .pills{display:flex;gap:.6rem;flex-wrap:wrap;width:100%;max-width:100%}
  .pill{font-family:system-ui,sans-serif;font-size:.82rem;background:#fff;border:1px solid var(--line);color:var(--ink);padding:.4rem .9rem;border-radius:20px;cursor:pointer;max-width:100%;white-space:normal;flex:0 0 auto}
  .pill.active{background:var(--accent);color:#fff;border-color:var(--accent)}
  .pill.active:hover{background:var(--accent)}
  .layout{display:flex;min-height:84vh}
  nav{width:230px;padding:1.6rem 1.4rem;border-right:1px solid var(--line);flex-shrink:0}
  nav .search{width:100%;padding:.55rem .8rem;border:1px solid var(--line);border-radius:20px;background:#fff;margin-bottom:1.4rem;font-family:system-ui,sans-serif;font-size:.85rem;color:var(--muted)}
  nav ul{list-style:none;padding:0;margin:0}
  nav a{color:var(--muted);text-decoration:none;display:block;padding:.45rem .3rem;font-family:system-ui,sans-serif;font-size:.9rem;border-bottom:1px dotted var(--line)}
  nav a:hover{color:var(--accent)}
  main{flex:1;padding:2rem 2.6rem;max-width:840px}
  .lead{font-size:1.05rem;color:var(--ink);font-style:italic;margin-bottom:1.5rem}
  .card{background:var(--card);border:1px solid var(--line);border-radius:4px;padding:1.7rem 2rem;margin-bottom:1.6rem;box-shadow:0 1px 0 var(--line)}
  .card h2{font-family:'Iowan Old Style',Palatino,Georgia,serif;font-size:1.5rem;margin:.2rem 0 .7rem}
  .tag{font-family:system-ui,sans-serif;font-size:.7rem;text-transform:uppercase;letter-spacing:1px;color:var(--accent);margin-right:.6rem}
  .card p{color:var(--muted);line-height:1.7;font-size:1rem;margin:.5rem 0;font-family:system-ui,sans-serif}
  .body img{max-width:100%;border-radius:4px}
  .body video{max-width:100%;border-radius:4px;margin:.5rem 0;background:#000;display:block}
  .body iframe{max-width:100%;border:0;border-radius:4px;margin:.5rem 0}
  .catlist li{margin:.3rem 0}
  .catlist a{color:var(--accent);font-weight:600;font-family:system-ui,sans-serif}
  .catdesc{color:var(--muted);font-family:system-ui,sans-serif}
  .hint{font-family:system-ui,sans-serif;font-size:.8rem;color:var(--muted);margin-top:2rem;border-top:1px dashed var(--line);padding-top:1rem}
  @media(max-width:600px){
    .layout{flex-direction:column}
    nav{width:100%;border-right:none;border-bottom:1px solid var(--line)}
    main{padding:1.3rem}
    .brand{font-size:1.25rem}
    header{overflow-x:hidden;padding:1rem}
    .pills{gap:.4rem}
    .pill{font-size:.78rem;padding:.35rem .7rem}
  }
</style>
</head>
<body>
<header>
  <div class="topbar">
    <div class="brand">Wiki <span>Preparacionismo</span></div>
    <div class="actions"><button onclick="goBack()" title="Volver atrás">⬅️ Atrás</button><button onclick="exportZip()">⬇️ Exportar web (ZIP)</button></div>
  </div>
  <div class="pills" id="pills">${pillsHtml}</div>
</header>
<div class="layout">
  <nav>
    <input id="search" placeholder="Buscar..." onkeyup="filter()">
    <ul id="navlist">${nav}</ul>
  </nav>
  <main>
${entries}
${catSections}
  </main>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<script>
var _history=[];
const CATS = ${JSON.stringify(CATEGORIES)};
function activeCatFor(id){
  if(id && id.indexOf('cat-')===0){ return decodeURIComponent(id.slice(4)); }
  const el=document.getElementById(id);
  if(el){
    const tags=[...el.querySelectorAll('.tags .tag')].map(t=>t.textContent.trim());
    for(const c of CATS){ if(tags.includes(c)) return c; }
  }
  return null;
}
function highlightCat(cat){
  document.querySelectorAll('#navlist a[data-cat]').forEach(a=>{
    if(cat && a.getAttribute('data-cat')===cat) a.classList.add('active');
    else a.classList.remove('active');
  });
  document.querySelectorAll('#pills .pill[data-cat]').forEach(a=>{
    if(cat && a.getAttribute('data-cat')===cat) a.classList.add('active');
    else a.classList.remove('active');
  });
}
function show(id){
  document.querySelectorAll('.view').forEach(s=>s.style.display='none');
  const el=document.getElementById(id);
  if(el){ el.style.display='block'; window.scrollTo(0,0); _history.push(id); highlightCat(activeCatFor(id)); }
}
function goBack(){
  if(_history.length>1){ _history.pop(); const prev=_history.pop(); show(prev); }
  else if(_history.length===1){ /* ya en inicio */ }
}
function filter(){
  const q=document.getElementById('search').value.toLowerCase().trim();
  if(!q){ show('${homeId}'); highlightCat(null); return; }
  document.querySelectorAll('.view').forEach(s=>s.style.display='none');
  document.querySelectorAll('.tiddler').forEach(s=>{
    if(s.innerText.toLowerCase().includes(q)){ s.style.display='block'; }
  });
  window.scrollTo(0,0);
  highlightCat(null);
}
// Al cargar: deep-link por hash si existe, si no -> Inicio
window.addEventListener('DOMContentLoaded',()=>{
  const h=location.hash.slice(1);
  if(h && document.getElementById(h)) show(h);
  else show('${homeId}');
});
// Genera el ZIP en el navegador (index.html + media local) para uso offline por file://
async function exportZip(){
  if(typeof JSZip==='undefined'){ alert('Cargando librería ZIP, inténtalo en unos segundos...'); return; }
  const btn=document.querySelector('header button');
  const old=btn.textContent; btn.textContent='⏳ Generando...'; btn.disabled=true;
  try{
    const zip=new JSZip();
    zip.file('index.html', document.documentElement.outerHTML);
    const dirs=['img','video','pdf'];
    for(const d of dirs){
      const re=new RegExp(d+'/[^"\\x27\\s)]+','g');
      const found=new Set([...document.documentElement.outerHTML.matchAll(re)].map(m=>m[0]));
      for(const rel of found){
        try{
          const r=await fetch(rel);
          if(r.ok){ const buf=await r.arrayBuffer(); zip.file(rel, buf); }
        }catch(e){ console.warn('No se pudo añadir',rel,e); }
      }
    }
    const blob=await zip.generateAsync({type:'blob'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    const mm=String(new Date().getMonth()+1).padStart(2,'0');
    const yyyy=new Date().getFullYear();
    a.download='wikiprep-'+mm+'-'+yyyy+'.zip';
    a.click();
    URL.revokeObjectURL(a.href);
  }catch(e){ alert('Error: '+e.message); }
  finally{ btn.textContent=old; btn.disabled=false; }
}
</script>
</body>
</html>`;
  fs.writeFileSync(OUT, html);
  console.log('Generado index.html con', tiddlers.length, 'articulo(s) y', CATEGORIES.length, 'categorias base');
}
build();
