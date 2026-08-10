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
<section class="view tiddler" id="${id}">
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
    .map(c => `<li><a href="#" onclick="show('cat-${encodeURIComponent(c)}')">${CAT_ICON[c]||''} ${c}</a></li>`).join('\n');
  const nav = `<li><a href="#" onclick="show('${homeId}')"><b>🏠 Inicio</b></a></li>\n${navCats}`;

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wiki Preparacionismo</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;margin:0;background:#f4f1ea;color:#222}
  header{background:#3a5a40;color:#fff;padding:1rem;position:sticky;top:0;display:flex;align-items:center;gap:1rem;flex-wrap:wrap}
  header h1{margin:0;font-size:1.3rem}
  header button{background:#a3b18a;color:#1c2b1f;border:none;border-radius:6px;padding:.5rem .9rem;font-size:.85rem;cursor:pointer;font-weight:600}
  header button:hover{background:#b5c99a}
  .layout{display:flex;min-height:80vh}
  nav{width:240px;background:#344e41;color:#fff;padding:1rem;flex-shrink:0}
  nav ul{list-style:none;padding:0;margin:0}
  nav a{color:#dad7cd;text-decoration:none;display:block;padding:.4rem 0}
  nav a:hover{color:#fff}
  main{flex:1;padding:1.5rem;max-width:820px}
  .view{display:none}
  .tiddler{border-bottom:1px solid #ccc;padding:1rem 0}
  .tags .tag{background:#a3b18a;color:#1c2b1f;border-radius:4px;padding:.1rem .5rem;font-size:.75rem;margin-right:.3rem}
  .body img{max-width:100%}
  .catlist li{margin:.3rem 0}
  .catlist a{color:#344e41;font-weight:600}
  .catdesc{color:#555}
  input#search{width:100%;padding:.5rem;margin-bottom:1rem;border-radius:6px;border:1px solid #ccc}
  @media(max-width:600px){.layout{flex-direction:column}nav{width:100%}}
</style>
</head>
<body>
<header>
  <h1>🛡️ Wiki Preparacionismo</h1>
  <button onclick="goBack()" title="Volver atrás">⬅️ Atrás</button>
  <button onclick="exportZip()">⬇️ Exportar web (ZIP)</button>
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
function show(id){
  document.querySelectorAll('.view').forEach(s=>s.style.display='none');
  const el=document.getElementById(id);
  if(el){ el.style.display='block'; window.scrollTo(0,0); _history.push(id); }
}
function goBack(){
  if(_history.length>1){ _history.pop(); const prev=_history.pop(); show(prev); }
  else if(_history.length===1){ /* ya en inicio */ }
}
function filter(){
  const q=document.getElementById('search').value.toLowerCase().trim();
  if(!q){ show('${homeId}'); return; }
  document.querySelectorAll('.view').forEach(s=>s.style.display='none');
  document.querySelectorAll('.tiddler').forEach(s=>{
    if(s.innerText.toLowerCase().includes(q)){ s.style.display='block'; }
  });
  window.scrollTo(0,0);
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
      const re=new RegExp(d+'/[^"\\\\\\'\\\\s)]+','g');
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
