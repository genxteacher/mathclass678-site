#!/usr/bin/env node
/* IndexNow: tell Bing (and the other IndexNow search engines) which pages changed.

     node tools/indexnow.js            send pages whose HTML changed since the last send
     node tools/indexnow.js --all      send every page in the sitemap
     node tools/indexnow.js --dry-run  show what would be sent, send nothing

   Run it AFTER a push has deployed. It rebuilds dist/, confirms the key file is live on
   www.mathclass678.com (engines reject a submission whose key they can't fetch), then posts the
   changed URLs to https://api.indexnow.org/indexnow. What was sent is recorded in
   data/indexnow-state.json (page -> content hash), so commit that file afterwards.

   Google does not use IndexNow; its sitemap in Search Console covers Google. */

'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const HOST = 'www.mathclass678.com';
const ORIGIN = `https://${HOST}`;  // the canonical host (mathclass678.com 301s here)
const KEY = fs.readFileSync(path.join(ROOT, 'data', 'indexnow.key'), 'utf8').trim();
const STATE = path.join(ROOT, 'data', 'indexnow-state.json');
const args = new Set(process.argv.slice(2));

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let body = '';
      res.on('data', d => { body += d; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}
function post(url, payload) {
  const data = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data) } }, res => {
      let body = '';
      res.on('data', d => { body += d; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end(data);
  });
}

// Page content without the parts that change on every build but mean nothing to a reader.
function fingerprint(html) {
  const stable = html
    .replace(/<div class="ruler-today"[^>]*>[\s\S]*?<\/div>/g, '')
    .replace(/<script id="site-data"[\s\S]*?<\/script>/g, '')
    .replace(/<lastmod>[^<]*<\/lastmod>/g, '');
  return crypto.createHash('sha1').update(stable).digest('hex');
}

async function main() {
  execFileSync(process.execPath, [path.join(ROOT, 'build_site.js')], { stdio: 'inherit' });
  const dist = path.join(ROOT, 'dist');
  const sitemap = fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const prev = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
  const next = {};
  const changed = [];
  for (const url of urls) {
    const rel = url.replace(ORIGIN + '/', '');
    const file = path.join(dist, rel === '' || rel.endsWith('/') ? rel + 'index.html' : rel);
    const hash = fingerprint(fs.readFileSync(file, 'utf8'));
    next[url] = hash;
    if (args.has('--all') || prev[url] !== hash) changed.push(url);
  }
  if (!changed.length) {
    console.log('IndexNow: no page changed since the last send.');
    return;
  }
  console.log(`IndexNow: ${changed.length} of ${urls.length} pages to send.`);
  if (args.has('--dry-run')) { changed.forEach(u => console.log('  ' + u)); return; }

  const keyUrl = `${ORIGIN}/${KEY}.txt`;
  const live = await get(keyUrl);
  if (live.status !== 200 || live.body.trim() !== KEY) {
    console.error(`Stopped: ${keyUrl} returned ${live.status}. Push and let Netlify deploy first.`);
    process.exit(1);
  }
  const res = await post('https://api.indexnow.org/indexnow', { host: HOST, key: KEY, keyLocation: keyUrl, urlList: changed });
  // 200 = received, 202 = received and key validation pending; anything else is an error.
  if (res.status === 200 || res.status === 202) {
    fs.writeFileSync(STATE, JSON.stringify(next, null, 1) + '\n');
    console.log(`Sent (HTTP ${res.status}). Recorded in data/indexnow-state.json; commit it.`);
  } else {
    console.error(`IndexNow answered HTTP ${res.status}: ${res.body.slice(0, 300)}`);
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
