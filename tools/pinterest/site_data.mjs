// Reads the content constants out of build_site.js (without running the build) plus the CSVs,
// so Pinterest pins use exactly the words the site pages use.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'build_site.js'), 'utf8');

function literal(name) {
  const at = SRC.indexOf(`const ${name} = `);
  if (at < 0) throw new Error(`build_site.js has no const ${name}`);
  let i = SRC.indexOf('=', at) + 1;
  while (/\s/.test(SRC[i])) i++;
  const open = SRC[i], close = open === '[' ? ']' : '}';
  let depth = 0, q = null, esc = false, j = i;
  for (; j < SRC.length; j++) {
    const c = SRC[j];
    if (q) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && SRC[j + 1] === '/') { j = SRC.indexOf('\n', j); continue; }
    if (c === '/' && SRC[j + 1] === '*') { j = SRC.indexOf('*/', j) + 1; continue; }
    if (c === open) depth++;
    else if (c === close && --depth === 0) break;
  }
  return vm.runInNewContext('(' + SRC.slice(i, j + 1) + ')');
}

export function csv(file) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/^﻿/, '');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const [head, ...body] = rows.filter(r => r.length > 1 || r[0]);
  return body.map(r => Object.fromEntries(head.map((h, k) => [h.trim(), (r[k] || '').trim()])));
}

export const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const cleanCCSS = c => String(c || '').split('-')[0].trim();

export function load() {
  const STANDARDS = literal('STANDARDS_CONTENT');
  const BUNDLES = literal('BUNDLES');
  const FREE_RESOURCES = literal('FREE_RESOURCES');
  const LINKS = JSON.parse(fs.readFileSync(path.join(ROOT, 'mc678_site_links.json'), 'utf8'));
  const catalog = csv('Master_Catalog_Skills.csv');
  const ican = csv('ICan_Statements_Master.csv');
  const glossary = {};
  for (const g of ['5th', '6th', '7th', '8th', 'Algebra', 'Geometry']) glossary[g] = csv(`WordWall_Content_${g}_MASTER.csv`);
  return { STANDARDS, BUNDLES, FREE_RESOURCES, LINKS, catalog, ican, glossary };
}
