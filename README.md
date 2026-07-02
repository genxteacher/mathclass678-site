# mathclass678.com — Site Source

Static site generator for [mathclass678.com](https://mathclass678.com).

## What this is

A custom Node.js static site generator that reads catalog data and emits a flat `dist/`
folder of plain HTML/CSS/JS files, deployed to Netlify.

## Repo structure

```
/
├── build_site.js              ← Generator — reads CSVs, emits dist/
├── styles.css                 ← Global stylesheet
├── netlify.toml               ← Build config (Netlify reads this)
├── package.json               ← Node metadata
├── Master_Catalog_Skills.csv  ← Catalog ground truth (103 sheets)
├── ICan_Statements_Master.csv ← Product-card descriptions
├── assets/
│   ├── images/
│   │   ├── thumbs/            ← 103 product thumbnails (thumb1_Nth_slug.jpg)
│   │   ├── bundles/           ← 30 bundle thumbnails
│   │   ├── freebies/          ← 16 free resource thumbnails
│   │   └── [12 site asset files]
│   └── js/
│       └── catalog.js         ← Client-side catalog filtering
└── dist/                      ← GITIGNORED — built by Netlify on push
```

## How it builds

Netlify runs `node build_site.js` on every push to `main`.
Output goes to `dist/`. No npm install needed (zero external dependencies).

## How to make changes

Open a Claude session. Claude modifies source files and pushes via Claude Code.
Greg does not edit source files directly.

## Brand
Forest green #1A3C34 · Gold #D4A017
Grade accents: Teal #3FA9A2 (6th) · Coral #D85D5D (7th) · Navy #2A4A7F (8th)
Never purple. No emojis. No exclamation points in product copy.
