# Wiki de Preparacionismo

Wiki de una sola página (un único `index.html`) con textos, imágenes y vídeos de preparacionismo.

## Estructura
```
preparacionismo/
├── index.html        ← LA wiki (todo el contenido salvo la media)
├── img/              ← imágenes externas
├── video/           ← vídeos externos
├── tiddlers/         ← artículos fuente (.tid, versionables)
├── build.js          ← ensambla index.html
└── .github/workflows/build.yml  ← GitHub Action (regenera + publica Pages)
```

## Cómo funciona
- Cada artículo es un `.tid` en `tiddlers/` (texto plano).
- Imágenes/vídeos se guardan en `img/` y `video/` y se enlazan con rutas relativas.
- Al hacer push, el Action regenera `index.html` y lo publica en GitHub Pages.

## Alojamiento
- **Online:** GitHub Pages (`mosqueteroweb.github.io/preparacionismo`).
- **Offline (Android + Chrome):** clonar el repo (p.ej. MGit) y abrir `index.html` en Chrome. Las rutas relativas `img/`, `video/` funcionan si se conserva la carpeta.

## Autoría
El asistente (Hermes) crea/actualiza los tiddlers y la media; el Action hace el resto.
