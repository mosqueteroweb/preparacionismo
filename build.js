#!/usr/bin/env node
/* build.js — ensambla index.html a partir de los .tid en tiddlers/
   Motor mínimo TiddlyWiki-compatible (solo render básico de texto/wiki).
   Dependencias: ninguna (Node built-in). */
const fs = require('fs');
const path = require('path');

const TID_DIR = path.join(__dirname, 'tiddlers');
const OUT = path.join(__dirname, 'index.html');
const MEDIA = { img: 'img', video: 'video' };

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

// Conversión wiki mínima: [[texto|url]] -> link, '''x''' -> <b>, ''x'' -> <i>, ! -> h1, * -> ul
function wiki2html(body) {
  let h = body
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/\[\[([^\]]+)\]\]/g, '<a href="#">$1</a>')
    .replace(/'''([^']+)'''/g, '<b>$1</b>')
    .replace(/''([^']+)''/g, '<i>$1</i>');
  // líneas
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

// Extraer <html>...</html> sin procesar (para video embebido)
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
  header{background:#3a5a40;color:#fff;padding:1rem;position:sticky;top:0}
  header h1{margin:0;font-size:1.3rem}
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
<header><h1>🛡️ Wiki Preparacionismo</h1></header>
<div class="layout">
  <nav>
    <input id="search" placeholder="Buscar..." onkeyup="filter()">
    <ul id="navlist">${nav}</ul>
  </nav>
  <main>${entries}</main>
</div>
<script>
function filter(){
  const q=document.getElementById('search').value.toLowerCase();
  document.querySelectorAll('.tiddler').forEach(s=>{
    s.style.display=s.innerText.toLowerCase().includes(q)?'':'none';
  });
}
</script>
</body>
</html>`;
  fs.writeFileSync(OUT, html);
  console.log('Generado index.html con', tiddlers.length, 'articulo(s)');
}
build();
