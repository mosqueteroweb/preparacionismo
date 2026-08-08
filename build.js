#!/usr/bin/env node
/* build.js — ensambla index.html a partir de los .tid en tiddlers/
   Motor mínimo (render básico de texto/wiki) + exportar ZIP offline.
   Dependencias: ninguna (Node built-in). */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const TID_DIR = path.join(ROOT, 'tiddlers');
const OUT = path.join(ROOT, 'index.html');

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

// Conversión wiki mínima
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
    else if (line.startsWith('* ')) { if(!inList){out+='<ul>';inList=true;} out += `<li>${line.slice(2)}</li>`; }
    else { if(inList){out+='</ul>';inList=false;} if(line.trim()) out += `<p>${line}</p>`; }
  }
  if (inList) out += '</ul>';
  return out;
}

function extractRawHtml(body) {
  const m = body.match(/<html>([\s\S]*?)<\/html>/);
  return m ? m[1] : '';
}

// Recolecta todos los archivos de media (img/, video/, pdf/) que existan
function collectMediaDirs() {
  const dirs = ['img', 'video', 'pdf'];
  const files = []; // {rel, abs}
  for (const d of dirs) {
    const abs = path.join(ROOT, d);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) {
      const fabs = path.join(abs, f);
      if (fs.statSync(fabs).isFile()) files.push({ rel: `${d}/${f}`, abs: fabs });
    }
  }
  return files;
}

function build() {
  const files = fs.readdirSync(TID_DIR).filter(f => f.endsWith('.tid'));
  const tiddlers = files.map(f => {
    const raw = fs.readFileSync(path.join(TID_DIR, f), 'utf8');
    return parseTid(raw);
  });

  const entries = tiddlers.map(t => {
    const title = t.meta.title || 'Sin título';
    const tags = (t.meta.tags || '').split(' ').filter(Boolean);
    const tagHtml = tags.map(tg => `<span class="tag">${tg}</span>`).join(' ');
    const htmlBody = wiki2html(t.body).replace(/<html>[\s\S]*?<\/html>/g, '');
    const rawHtml = extractRawHtml(t.body);
    return `
<section class="tiddler" id="${encodeURIComponent(title)}">
  <h2>${title}</h2>
  <div class="tags">${tagHtml}</div>
  <div class="body">${htmlBody}${rawHtml}</div>
</section>`;
  }).join('\n');

  const titles = tiddlers.map(t => t.meta.title).filter(Boolean);
  const nav = titles.map(t => `<li><a href="#${encodeURIComponent(t)}">${t}</a></li>`).join('\n');

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
  main{flex:1;padding:1.5rem;max-width:800px}
  .tiddler{border-bottom:1px solid #ccc;padding:1rem 0}
  .tags .tag{background:#a3b18a;color:#1c2b1f;border-radius:4px;padding:.1rem .5rem;font-size:.75rem;margin-right:.3rem}
  .body img{max-width:100%}
  input#search{width:100%;padding:.5rem;margin-bottom:1rem;border-radius:6px;border:1px solid #ccc}
  @media(max-width:600px){.layout{flex-direction:column}nav{width:100%}}
</style>
</head>
<body>
<header>
  <h1>🛡️ Wiki Preparacionismo</h1>
  <button onclick="exportZip()">⬇️ Exportar web (ZIP)</button>
</header>
<div class="layout">
  <nav>
    <input id="search" placeholder="Buscar..." onkeyup="filter()">
    <ul id="navlist">${nav}</ul>
  </nav>
  <main>${entries}</main>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<script>
function filter(){
  const q=document.getElementById('search').value.toLowerCase();
  document.querySelectorAll('.tiddler').forEach(s=>{
    s.style.display=s.innerText.toLowerCase().includes(q)?'':'none';
  });
}
async function exportZip(){
  if(typeof JSZip==='undefined'){alert('Cargando librería ZIP, inténtalo en unos segundos...');return;}
  const btn=document.querySelector('header button');
  const old=btn.textContent; btn.textContent='⏳ Generando...'; btn.disabled=true;
  try{
    const zip=new JSZip();
    zip.file('index.html', document.documentElement.outerHTML);
    const dirs=['img','video','pdf'];
    for(const d of dirs){
      // buscar rutas relativas referenciadas en el HTML
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
    a.download='wiki-preparacionismo.zip';
    a.click();
    URL.revokeObjectURL(a.href);
  }catch(e){ alert('Error: '+e.message); }
  finally{ btn.textContent=old; btn.disabled=false; }
}
</script>
</body>
</html>`;
  fs.writeFileSync(OUT, html);
  console.log('Generado index.html con', tiddlers.length, 'articulo(s)');
}
build();
