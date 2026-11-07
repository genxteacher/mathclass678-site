#!/usr/bin/env node
/* ============================================================================
   tools/live_refresh.js  (Nov 7 2026)
   Brings the site's TPT facts in line with a crawl of the live store. Re-runnable; zero dependencies.

     node tools/live_refresh.js <path/to/live_all.json>

   live_all.json = { total, items: { "<id>": { title, kind, url, list, price, free, pages, cover, status } } },
   one entry per LIVE listing in the TPT math store (bundles: kind BundleResource, price = the bundle price,
   list = the sum of its singles). A listing that is not in the file is not live.

   Writes:
     data/live_tpt.json   id -> { title, url, price, list, pages, kind, free } for every live listing. build_site.js
                          reads it to put each TPT link on its current canonical URL, to fill the Checkpoint 2
                          band, and its TPT-URL GATE fails the build on any link that is not the current URL.
     live_ids.json        exactly the live ids (the LIVE-ID GATE's list).
     retired_ids.json     + every id the repo's data or build_site.js still names that is no longer live;
                          - any id that is live again.
   Patches, in place (only fields that already exist; nothing is added):
     url / tpt_url        -> the live URL, in every data JSON below
     title                -> the live title (ilearn_data, classroom_data, skillsheet_data)
     price, list          -> the live price / list price (number, or "$x.xx" string, as the file has it);
                             a bundle's save / pct are recomputed when present
     pages, tpt_pages     -> the live TPT page count (ilearn_data only; skillsheet_data `pages` is the packet)
   ============================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const src = process.argv[2];
if (!src || !fs.existsSync(src)) { console.error('usage: node tools/live_refresh.js <live_all.json>'); process.exit(1); }
const LIVE = JSON.parse(fs.readFileSync(src, 'utf8')).items;
const liveIds = Object.keys(LIVE).sort();
const today = new Date().toISOString().slice(0, 10);
if (liveIds.length < 100) { console.error(`live_all.json has only ${liveIds.length} listings: refusing (a partial crawl would retire the store)`); process.exit(1); }

const rd = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const wr = (f, obj, indent = 1) => fs.writeFileSync(path.join(ROOT, f), JSON.stringify(obj, null, indent) + '\n');
const idOf = u => { const m = String(u || '').split(/[?#]/)[0].match(/teacherspayteachers\.com\/Product\/.*?-(\d{6,9})$/i); return m ? m[1] : null; };

/* 1. canonical map */
const items = {};
for (const id of liveIds) {
  const l = LIVE[id];
  items[id] = { title: l.title, url: l.url, price: l.price, list: l.list, pages: l.pages, kind: l.kind, free: !!l.free || l.price === 0 };
}
wr('data/live_tpt.json', { source: `TPT store crawl (${path.basename(src)}), written by tools/live_refresh.js`, crawled: today, count: liveIds.length, items });

/* 2. patch data files */
const FILES = {
  'ilearn_data.json':     { title: true, price: true, pages: true },
  'classroom_data.json':  { title: true, price: true },
  'skillsheet_data.json': { title: true, price: true },
  'social_data.json':     {},
  'free_new.json':        {},
  'video_data.json':      {},
  'mc678_site_links.json': {},
};
const money = v => '$' + Number(v).toFixed(2);
const changes = {};
const bump = (f, k) => { changes[f] = changes[f] || {}; changes[f][k] = (changes[f][k] || 0) + 1; };
function patch(x, f, opt) {
  if (Array.isArray(x)) { x.forEach(v => patch(v, f, opt)); return; }
  if (!x || typeof x !== 'object') return;
  const urlKey = ['url', 'tpt_url'].find(k => idOf(x[k]));
  const id = urlKey ? idOf(x[urlKey]) : null;
  if (id && LIVE[id]) {
    const l = LIVE[id];
    if (x[urlKey] !== l.url) { x[urlKey] = l.url; bump(f, 'url'); }
    if (opt.title && typeof x.title === 'string' && x.title !== l.title) { x.title = l.title; bump(f, 'title'); }
    if (opt.price) {
      let priceChanged = false;
      for (const [k, v] of [['price', l.price], ['list', l.list]]) {
        if (typeof x[k] === 'number' && Math.abs(x[k] - v) > 0.004) { x[k] = v; bump(f, k); priceChanged = true; }
        else if (typeof x[k] === 'string' && /^\$\d/.test(x[k]) && x[k] !== money(v) && v > 0) { x[k] = money(v); bump(f, k); priceChanged = true; }
      }
      if (priceChanged && l.list > l.price) {
        if (typeof x.save === 'string') x.save = money(l.list - l.price);
        else if (typeof x.save === 'number') x.save = Math.round((l.list - l.price) * 100) / 100;
        if (typeof x.pct === 'number') x.pct = Math.round((1 - l.price / l.list) * 100);
        if (typeof x.discount === 'number') x.discount = Math.round((1 - l.price / l.list) * 100);
      }
    }
    if (opt.pages && l.pages) for (const k of ['pages', 'tpt_pages']) if (typeof x[k] === 'number' && x[k] !== l.pages) { x[k] = l.pages; bump(f, k); }
  }
  for (const v of Object.values(x)) if (v && typeof v === 'object') patch(v, f, opt);
}
for (const [f, opt] of Object.entries(FILES)) {
  if (!fs.existsSync(path.join(ROOT, f))) continue;
  const raw = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const indent = (raw.match(/\n( +)"/) || [, ' '])[1].length;
  const d = JSON.parse(raw);
  patch(d, f, opt);
  const out = JSON.stringify(d, null, indent) + '\n';
  if (out !== raw && changes[f]) fs.writeFileSync(path.join(ROOT, f), out);
}

/* 3. live_ids.json */
const oldLive = rd('live_ids.json');
wr('live_ids.json', { source: `TPT store crawl ${today} (every live listing), written by tools/live_refresh.js`, ids: liveIds }, 1);

/* 4. retired_ids.json: every id the repo names that is not live */
const retired = rd('retired_ids.json');
const named = {};
const scanText = (text) => { for (const m of text.matchAll(/teacherspayteachers\.com\/Product\/([^"'\s<>)]*?)-(\d{6,9})(?=["'\s<>)?#&]|$)/gi)) named[m[2]] = named[m[2]] || m[1].replace(/-/g, ' '); };
['build_site.js', ...Object.keys(FILES)].forEach(f => { if (fs.existsSync(path.join(ROOT, f))) scanText(fs.readFileSync(path.join(ROOT, f), 'utf8')); });
(oldLive.ids || []).forEach(id => { named[id] = named[id] || ''; });
let added = 0, revived = [];
for (const [id, label] of Object.entries(named)) {
  if (!LIVE[id] && !retired.ids[id]) { retired.ids[id] = (label || 'not in the live store') + ` (not live on ${today})`; added++; }
}
for (const id of Object.keys(retired.ids)) if (LIVE[id]) { delete retired.ids[id]; revived.push(id); }
retired._about = 'TPT listing ids that are not live (deactivated or deleted on TPT). build_site.js RETIRED-ID GATE fails the build if any file in dist links to one of these ids. tools/live_refresh.js adds every id the repo still names that is missing from a fresh store crawl, and drops any id that is live again.';
retired.updated = today;
wr('retired_ids.json', retired, 1);

console.log(`live listings: ${liveIds.length} -> data/live_tpt.json, live_ids.json (was ${(oldLive.ids || []).length})`);
console.log(`retired_ids.json: +${added} not live${revived.length ? `, -${revived.length} live again (${revived.join(', ')})` : ''}, ${Object.keys(retired.ids).length} total`);
for (const [f, c] of Object.entries(changes)) console.log(`patched ${f}: ` + Object.entries(c).map(([k, n]) => `${k} ${n}`).join(', '));
if (!Object.keys(changes).length) console.log('data files: already current');
