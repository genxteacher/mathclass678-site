#!/usr/bin/env node
/* Pinterest pins for mathclass678.com.

     node tools/pinterest/pins.mjs --batch 2026-09 [--dry-run]

   Builds the site (dist/ is the check that every pin's page exists), picks the batch's pins from the
   site's own content, renders each one at 1000x1500 in headless Chrome (Fraunces / Inter / IBM Plex Mono,
   brand tokens from styles.css), and writes:

     assets/pins/<batch>/<slug>.jpg      published with the site (build_site.js copies assets/pins)
     pinterest/<batch>.csv               Pinterest bulk upload: Settings > Import content > Bulk create Pins

   Rules the pins keep (same as the site): never purple, no emojis, no exclamation points, no prices,
   CCSS clean leaf codes, exact SkillName, and Word Wall pins never show card art (the term's content is
   re-set natively). Every pin links to a mathclass678.com page with its own utm tags, because the bulk
   upload keeps only the first row for any Link.

   Times: three pins a day at 5:30 am, 3:45 pm and 9:15 pm Central (statetestmath.com uses 6:15 am,
   7:00 pm and 8:30 pm), converted to UTC with daylight saving handled. Pinterest schedules at most
   30 days ahead, so each batch covers 29 days and is uploaded no earlier than 30 days before its last pin. */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { load, ROOT, slugify, cleanCCSS } from './site_data.mjs';

const SITE = 'https://www.mathclass678.com';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const BATCH = opt('--batch') || '2026-09';
const DRY = args.includes('--dry-run');

const SLOTS = [[5, 30], [15, 45], [21, 15]];
const DAYS = 29;

const C = {
  forest: '#1A3C34', forestDeep: '#112a24', forestSoft: '#245046', gold: '#D4A017', goldSoft: '#e6be4f',
  off: '#F7F5F0', warm: '#f0ece2', char: '#2C2C2C', charSoft: '#5A5A5A', line: '#e2ddd2',
  teal: '#3FA9A2', coral: '#D85D5D', navy: '#2A4A7F', slate: '#5B6B78',
};
const ACCENT = { '5': C.forest, '6': C.teal, '7': C.coral, '8': C.navy, Algebra: C.gold, Geometry: C.slate };
const TINT = { '5': '#e7efec', '6': '#eaf5f4', '7': '#fbeded', '8': '#e9edf5', Algebra: '#f8f0d9', Geometry: '#eceff1' };
const gradeWords = g => ({ '5': '5th Grade', '6': '6th Grade', '7': '7th Grade', '8': '8th Grade', Algebra: 'Algebra 1', Geometry: 'Geometry' })[g];
const gkey = g => { const m = String(g).match(/\d/); return m ? m[0] : (/alg/i.test(g) ? 'Algebra' : 'Geometry'); };

const WORD_WALL_BOARD = g => ({
  '5': '5th Grade Math Word Wall | Vocabulary Cards', '6': '6th Grade Math Word Wall | Vocabulary Cards',
  '7': '7th Grade Math Word Wall | Vocabulary Cards', '8': '8th Grade Math Word Wall | Vocabulary Cards',
  Algebra: 'Algebra 1 Math Word Wall | Vocabulary Cards', Geometry: 'Geometry Math Word Wall | Vocabulary Cards',
})[g];
const STRAND_BOARD = {
  '6|EE': '6th Grade Expressions and Equations | 6.EE Math', '6|G': '6th Grade Geometry | Area Volume Surface Area 6.G',
  '6|NS': '6th Grade Number System | 6.NS Math', '6|RP': '6th Grade Ratios and Rates | 6.RP Math',
  '6|SP': '6th Grade Statistics and Probability | 6.SP Math',
  '7|RP': '7th Grade Proportional Relationships | 7.RP Math', '7|NS': '7th Grade Integers and Rational Numbers | 7.NS Math',
  '7|EE': '7th Grade Expressions and Equations | 7.EE Math', '7|G': '7th Grade Geometry | Angles Area Circles 7.G',
  '7|SP': '7th Grade Statistics and Probability | 7.SP Math',
  '8|NS': '8th Grade Number System | Irrational Numbers 8.NS', '8|EE': '8th Grade Expressions and Equations | 8.EE Math',
  '8|F': '8th Grade Functions | 8.F Math', '8|G': '8th Grade Geometry | Transformations Pythagorean Theorem 8.G',
  '8|SP': '8th Grade Statistics and Probability | 8.SP Math',
};
const SYSTEM_BOARD = '4-in-1 Skill Sheets | Middle School Math System';
const FREE_BOARD = 'Free Middle School Math Resources | Grades 6-8';

/* ------------------------------------------------------------------ content */
const D = load();
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = s => String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const clip = (s, n) => { s = plain(s); if (s.length <= n) return s; const c = s.slice(0, n); const p = Math.max(c.lastIndexOf('. '), c.lastIndexOf('; ')); return p > n * 0.6 ? c.slice(0, p + 1) : c.slice(0, c.lastIndexOf(' ')).replace(/[,;:]$/, '') + '…'; };
const sentence = s => { s = plain(s); return /[.?)]$/.test(s) ? s : s + '.'; };

function distPage(rel) {
  if (!fs.existsSync(path.join(ROOT, 'dist', rel))) throw new Error(`no page dist/${rel}`);
  return `${SITE}/${rel}`;
}

// Skill sheet pages: match dist/sheets/*.html by the name and grade in each page's <title>.
const sheetPage = {};
for (const f of fs.existsSync(path.join(ROOT, 'dist/sheets')) ? fs.readdirSync(path.join(ROOT, 'dist/sheets')) : []) {
  const t = (fs.readFileSync(path.join(ROOT, 'dist/sheets', f), 'utf8').match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const m = plain(t).match(/^(.*?) — (\d)th Grade Math Skill Sheet/);
  if (m) sheetPage[slugify(m[1]) + '|' + m[2]] = 'sheets/' + f;
}
const nameClean = s => String(s).replace(/\s*\((?:FREE|Free)[^)]*\)\s*/g, ' ').replace(/\bFREE\b\s*/g, '').trim();
const icanByUrl = Object.fromEntries(D.ican.filter(r => r.Source === 'catalog' && r.PairURL).map(r => [r.PairURL, r.Statement]));
const SHEETS = D.catalog.filter(r => /SHIPPED/.test(r.Status)).map(r => {
  const g = gkey(r.Grade), ccss = cleanCCSS(r.CCSS), name = nameClean(r.SkillName);
  return { num: Number(r.SheetNumber), g, ccss, strand: ccss.split('.')[1], name, url: r.TPT_URL,
           ican: icanByUrl[r.TPT_URL] || '', page: sheetPage[slugify(name) + '|' + g] };
});
const sheetByNum = Object.fromEntries(SHEETS.map(s => [s.num, s]));
const STANDARDS = Object.values(D.STANDARDS);

// Kit-gated freebie pages: same slug rule as build_site.js (FREEBIES).
const freeBase = {};
D.LINKS.free_resources.forEach(f => { const b = slugify(f.name); freeBase[b] = (freeBase[b] || 0) + 1; });
const freeUsed = {};
const FREEBIES = D.LINKS.free_resources.map(f => {
  let base = slugify(f.name);
  if (freeBase[base] > 1) base += '-grade-' + ((String(f.grade).match(/\d/) || [])[0] || String(f.grade).toLowerCase());
  while (freeUsed[base]) base += '-x';
  freeUsed[base] = true;
  const r = D.FREE_RESOURCES.find(x => x.url === f.tpt_url) || {};
  return { slug: base, name: f.name, full: f.full_title || f.name, grade: f.grade, title: r.title || nameClean(f.name),
           sub: r.sub || '', gradeLabel: r.gradeLabel || '', cat: r.cat || '', thumb: r.thumb || '' };
});

/* ------------------------------------------------------------------ pin builders */
const tag = (link, slug) => `${link}?utm_source=pinterest&utm_medium=social&utm_campaign=${BATCH}&utm_content=${slug}`;

function vocabPin(g, row) {
  const gw = gradeWords(g), ccss = row.primary_ccss;
  const eyebrow = g === 'Algebra' || g === 'Geometry' ? `${gw} vocabulary · ${row.strand}` : `${gw} math vocabulary · ${ccss}`;
  const slug = `ww-${row.slug}`;
  return {
    kind: 'vocab', g, slug, board: WORD_WALL_BOARD(g), link: tag(distPage(`word-wall/${row.slug}.html`), slug),
    title: clip(`${row.term}: ${gw} Math Vocabulary Definition and Example`, 100),
    desc: clip(`${row.term} definition for ${gw} math${ccss ? ` (${ccss})` : ''}: ${sentence(row.definition)} Example: ${sentence(row.example_1)} Key rule: ${sentence(row.key_rule)} The glossary page has more examples, plus the printable ${gw} word wall.`, 490),
    kw: `${row.term.toLowerCase()} definition, ${gw.toLowerCase()} math vocabulary, math word wall`,
    html: frame(g, eyebrow, row.term, `
      <div class="blk"><div class="lbl">Definition</div><p class="big">${esc(row.definition)}</p></div>
      <div class="blk panel"><div class="lbl">Example</div><p>${esc(row.example_1)}</p>${row.example_2 ? `<p class="soft">${esc(row.example_2)}</p>` : ''}</div>
      <div class="blk"><div class="lbl">Key rule</div><p class="strong">${esc(row.key_rule)}</p></div>
      ${row.memory_hook ? `<div class="hook">${esc(row.memory_hook)}</div>` : ''}`,
      `Free glossary page · printable ${gw} word wall`),
  };
}

function examplePin(st, ex, i) {
  const g = st.grade, gw = gradeWords(g), slug = `std-${st.slug}-example-${i + 1}`;
  const steps = ex.steps.filter(s => plain(s) !== plain(ex.answer));
  return {
    kind: 'example', g, slug, board: STRAND_BOARD[`${g}|${st.strand}`], link: tag(distPage(`standards/${st.slug}.html`), slug),
    title: clip(`${plain(st.title)}: ${gw} Math Worked Example (${st.ccss})`, 100),
    desc: clip(`A step-by-step ${gw} math example for ${st.ccss}, ${plain(st.title)}. Problem: ${plain(ex.problem)} ${steps.map(sentence).join(' ')} Answer: ${sentence(ex.answer)} More worked examples and the common mistakes to watch for are on the page.`, 490),
    kw: `${plain(st.title).toLowerCase()}, ${gw.toLowerCase()} math, ${st.ccss}`,
    html: frame(g, `${st.ccss} · worked example${ex.label ? ' · ' + ex.label : ''}`, plain(st.title), `
      <div class="blk"><div class="lbl">Problem</div><div class="problem">${esc(ex.problem)}</div></div>
      <ol class="steps">${steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      <div class="answer"><span>Answer</span>${esc(ex.answer)}</div>`,
      'More examples and common mistakes on the page'),
  };
}

function tipPin(st) {
  const g = st.grade, gw = gradeWords(g), slug = `std-${st.slug}-mistakes`;
  const m = plain(st.tip).match(/First:\s*(.*?)\s*Second:\s*(.*)$/);
  if (!m) return null;
  return {
    kind: 'tip', g, slug, board: STRAND_BOARD[`${g}|${st.strand}`], link: tag(distPage(`standards/${st.slug}.html`), slug),
    title: clip(`${plain(st.title)}: 2 Mistakes to Head Off in ${gw} Math (${st.ccss})`, 100),
    desc: clip(`Two predictable ${gw} math errors on ${st.ccss}, ${plain(st.title)}, and how to head them off. First: ${sentence(m[1])} Second: ${sentence(m[2])} Worked examples are on the page.`, 490),
    kw: `${plain(st.title).toLowerCase()} common mistakes, ${gw.toLowerCase()} math, ${st.ccss}`,
    html: frame(g, `${gw} · ${st.ccss} · teaching tip`, `${plain(st.title)}: two mistakes to head off`, `
      <div class="tip"><div class="num">1</div><div><div class="lbl">First</div><p>${esc(m[1])}</p></div></div>
      <div class="tip"><div class="num">2</div><div><div class="lbl">Second</div><p>${esc(m[2])}</p></div></div>`,
      'Worked examples for every standard'),
  };
}

function sheetPin(s) {
  if (!s.page) return null;
  const gw = gradeWords(s.g), slug = `sheet-${slugify(s.name)}-${s.g}`;
  const ican = s.ican ? 'I can ' + s.ican.replace(/\.$/, '') + '.' : '';
  return {
    kind: 'sheet', g: s.g, slug, board: STRAND_BOARD[`${s.g}|${s.strand}`] || SYSTEM_BOARD, link: tag(distPage(s.page), slug),
    title: clip(`${s.name} Notes and Practice Worksheet | ${gw} Math ${s.ccss}`, 100),
    desc: clip(`${s.name} for ${gw} math (${s.ccss}). ${ican} One 4-in-1 Skill Sheet: a color reference page, guided practice, real-world application and a short assessment. See what is inside on the page.`, 490),
    kw: `${s.name.toLowerCase()} worksheet, ${gw.toLowerCase()} math, ${s.ccss}`,
    html: frame(s.g, `${gw} math · ${s.ccss} · 4-in-1 Skill Sheet`, s.name, `
      ${ican ? `<p class="ican">${esc(ican)}</p>` : ''}
      <div class="quad">
        <div style="--q:${C.teal}"><b>Reference</b><span>Color notes with the rule and examples</span></div>
        <div style="--q:${C.gold}"><b>Practice</b><span>Guided practice, step by step</span></div>
        <div style="--q:${C.coral}"><b>Apply</b><span>Real-world application problems</span></div>
        <div style="--q:${C.navy}"><b>Assess</b><span>A short check for understanding</span></div>
      </div>`,
      'See inside the skill sheet'),
  };
}

function bundlePin(b) {
  const g = b.grade, gw = gradeWords(g), slug = `bundle-${b.slug}`;
  const name = b.name.replace(/(Grade) The /, '$1 ');
  const sheets = (b.sheets || []).map(n => sheetByNum[n]).filter(Boolean);
  return {
    kind: 'bundle', g, slug, board: SYSTEM_BOARD, link: tag(distPage(`bundles/${b.slug}.html`), slug),
    title: clip(`${name} Bundle | ${sheets.length} Notes and Practice Worksheets`, 100),
    desc: clip(`${plain(b.blurb)} Skills: ${sheets.map(s => s.name).join(', ')}.`, 490),
    kw: `${name.toLowerCase()} worksheets, ${gw.toLowerCase()} math bundle, 4-in-1 skill sheets`,
    html: frame(g, `${gw} math · ${sheets.length} skill sheets`, `${name} bundle`, `
      <ul class="list">${sheets.slice(0, 9).map(s => `<li><span class="code">${esc(s.ccss)}</span>${esc(s.name)}</li>`).join('')}</ul>
      <p class="soft center">Each skill: reference · practice · apply · assess</p>`,
      'Every skill in the unit, in one place'),
  };
}

function freePin(f) {
  const slug = `free-${f.slug}`, gl = f.gradeLabel || (String(f.grade).match(/\d/) ? `${String(f.grade).match(/\d/)[0]}th Grade` : 'Grades 6–8');
  const thumb = f.thumb && fs.existsSync(path.join(ROOT, 'assets/images/freebies', f.thumb)) ? path.join(ROOT, 'assets/images/freebies', f.thumb) : '';
  const g = gkey(gl) === 'Geometry' ? '6' : gkey(gl);
  return {
    kind: 'free', g, slug, board: FREE_BOARD, link: tag(distPage(`free/${f.slug}.html`), slug),
    title: clip(`Free ${f.title}${f.sub ? ': ' + f.sub : ''} | ${gl} Math`, 100),
    desc: clip(`A free ${f.title.toLowerCase()} for ${gl.replace('Grades', 'grades')} math${f.sub ? ` (${f.sub.toLowerCase()})` : ''}. Enter your email on the page and it sends you straight to the free download.`, 490),
    kw: `free ${f.title.toLowerCase()}, ${gl.toLowerCase()} math, free middle school math`,
    html: frame(g, `Free · ${gl} math`, `Free ${f.title}`, `
      ${f.sub ? `<p class="big center">${esc(f.sub)}</p>` : ''}
      ${thumb ? `<div class="thumb"><img src="file://${esc(thumb)}" alt=""></div>` : ''}`,
      'Free download'),
  };
}

/* ------------------------------------------------------------------ batch plans */
// Typical middle school pacing: pins go up a few weeks before the unit is taught.
const PLANS = {
  '2026-09': {
    start: '2026-09-16',
    note: 'Back to school; first units: number system, integers, exponents; Algebra 1 expressions; Geometry basics',
    vocab: { '5': ['Number & Operations in Base Ten'], '6': ['The Number System'], '7': ['The Number System'], '8': ['The Number System', 'Expressions & Equations'], Algebra: ['Expressions & Equations'], Geometry: ['Points, Lines & Angles'] },
    standards: /^(6\.NS|7\.NS|8\.NS|8\.EE\.A)/, examples: 15, tips: 6, sheets: 11,
    bundles: ['6th-grade-number-system', '7th-grade-integer-operations', '8th-grade-exponents-scientific-notation'],
    free: ['free-back-to-school-math-diagnostic', '6th-grade-math-smart-goals-free', '7th-grade-math-smart-goals-free', '8th-grade-math-smart-goals-free', '6th-grade-math-about-me', '7th-grade-math-about-me', '6th-grade-math-year-at-a-glance-free', '7th-grade-math-year-at-a-glance-free', 'middle-school-math-word-wall', '3-day-emergency-math-sub-plan'],
  },
  '2026-10': {
    start: '2026-10-16',
    note: 'Ratios and proportional relationships, linear equations, Algebra 1 inequalities, parallel lines, fractions',
    vocab: { '5': ['Number & Operations—Fractions'], '6': ['Ratios & Proportional Relationships'], '7': ['Ratios & Proportional Relationships'], '8': ['Expressions & Equations'], Algebra: ['Inequalities'], Geometry: ['Parallel Lines & Angle Pairs', 'Triangles & Congruence'] },
    standards: /^(6\.RP|7\.RP|8\.EE\.[BC])/, examples: 18, tips: 7, sheets: 14,
    bundles: ['6th-grade-ratios-proportional-relationships', '7th-grade-ratios-proportional-relationships', '8th-grade-linear-equations-slope'],
    free: ['combining-like-terms-grade-6', 'combining-like-terms-grade-7', 'free-combining-like-terms-poster'],
  },
};
const PER_GRADE_VOCAB = 7;

function pick(plan) {
  const out = [];
  const wwSkip = r => plain(r.definition).length > 230 || plain(r.example_1).length > 170 || !r.key_rule;
  for (const [g, strands] of Object.entries(plan.vocab)) {
    const src = g === 'Algebra' ? 'Algebra' : g === 'Geometry' ? 'Geometry' : `${g}th`;
    const rows = D.glossary[src].filter(r => strands.includes(r.strand) && !wwSkip(r));
    out.push(...rows.slice(0, PER_GRADE_VOCAB).map(r => vocabPin(g, r)));
  }
  const stds = STANDARDS.filter(s => plan.standards.test(s.ccss));
  const exs = [];
  for (let round = 0; round < 3 && exs.length < plan.examples; round++)
    for (const s of stds) {
      const ex = (s.examples || [])[round];
      if (ex && !/[<>]|object Object/.test([ex.problem, ...ex.steps, ex.answer].join(' ')) && exs.length < plan.examples) exs.push(examplePin(s, ex, round));
    }
  out.push(...exs);
  out.push(...stds.map(tipPin).filter(Boolean).slice(0, plan.tips));
  const nums = [...new Set(stds.flatMap(s => s.sheets || []))];
  out.push(...nums.map(n => sheetByNum[n]).filter(Boolean).map(sheetPin).filter(Boolean).slice(0, plan.sheets));
  out.push(...plan.bundles.map(slug => bundlePin(D.BUNDLES.find(b => b.slug === slug))));
  out.push(...plan.free.map(slug => { const f = FREEBIES.find(x => x.slug === slug); if (!f) throw new Error('no freebie ' + slug); return freePin(f); }));
  return out;
}

function interleave(pins) {
  const order = ['free', 'vocab', 'example', 'sheet', 'vocab', 'tip', 'vocab', 'example', 'bundle', 'vocab', 'sheet', 'vocab'];
  const buckets = {};
  pins.forEach(p => (buckets[p.kind] ||= []).push(p));
  const out = [];
  let lastG = null;
  while (Object.values(buckets).some(b => b.length)) {
    for (const k of order) {
      const b = buckets[k];
      if (!b || !b.length) continue;
      const i = Math.max(0, b.findIndex(p => p.g !== lastG));
      const [p] = b.splice(i, 1);
      out.push(p); lastG = p.g;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ schedule (America/Chicago -> UTC) */
function chicagoToUTC(ymd, h, m) {
  const [y, mo, d] = ymd.split('-').map(Number);
  let t = Date.UTC(y, mo - 1, d, h, m);
  for (let k = 0; k < 2; k++) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(t).map(p => [p.type, p.value]));
    const shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    t += Date.UTC(y, mo - 1, d, h, m) - shown;
  }
  return new Date(t).toISOString().slice(0, 19);
}
function schedule(n, start) {
  const out = [];
  const d0 = new Date(start + 'T12:00:00Z');
  for (let day = 0; out.length < n; day++) {
    if (day >= DAYS) throw new Error(`${n} pins do not fit in ${DAYS} days at ${SLOTS.length} a day`);
    const ymd = new Date(d0.getTime() + day * 864e5).toISOString().slice(0, 10);
    for (const [h, m] of SLOTS) if (out.length < n) out.push(chicagoToUTC(ymd, h, m));
  }
  return out;
}

/* ------------------------------------------------------------------ page template */
function frame(g, eyebrow, title, body, cta) {
  const acc = ACCENT[g] || C.forest, tint = TINT[g] || '#e7efec';
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;0,9..144,800;1,9..144,500;1,9..144,600&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=block">
<style>
:root{--k:1;--kt:1;--u:calc(var(--k)*1px);--acc:${acc};--tint:${tint}}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1000px;height:1500px;overflow:hidden}
body{display:flex;flex-direction:column;background:${C.off};color:${C.char};font-family:Inter,sans-serif}
.bar{height:16px;background:linear-gradient(90deg,${C.teal} 0 25%,${C.gold} 25% 50%,${C.coral} 50% 75%,${C.navy} 75%)}
header{background:${C.forest};padding:60px 76px 58px;position:relative}
header::after{content:"";position:absolute;left:76px;bottom:0;width:120px;height:8px;background:var(--acc)}
.eyebrow{font:600 25px/1.3 "IBM Plex Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:${C.goldSoft};margin-bottom:22px}
h1{font-family:Fraunces,serif;font-weight:800;font-size:calc(var(--kt)*92px);line-height:1.04;letter-spacing:-.01em;color:#fff;font-variation-settings:"opsz" 144}
.fit{flex:1;min-height:0;padding:0 76px;display:flex;flex-direction:column;justify-content:center;overflow:hidden}
.inner{display:flex;flex-direction:column;gap:calc(34*var(--u));padding-block:calc(44*var(--u))}
.lbl{font:600 calc(24*var(--u))/1 "IBM Plex Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--acc);margin-bottom:calc(14*var(--u))}
p{font-size:calc(40*var(--u));line-height:1.36}
.big{font-size:calc(46*var(--u));line-height:1.3;color:${C.char}}
.strong{font-weight:600}
.soft{color:${C.charSoft};font-size:calc(34*var(--u));margin-top:calc(10*var(--u))}
.center{text-align:center}
.panel{background:#fff;border:2px solid ${C.line};border-radius:16px;padding:calc(30*var(--u)) calc(34*var(--u))}
.hook{font-family:Fraunces,serif;font-style:italic;font-weight:600;font-size:calc(50*var(--u));line-height:1.2;color:${C.forest};background:var(--tint);border-radius:16px;padding:calc(30*var(--u)) calc(36*var(--u))}
.hook::before{content:"Remember it";display:block;font:600 calc(22*var(--u))/1 "IBM Plex Mono",monospace;font-style:normal;letter-spacing:.08em;text-transform:uppercase;color:var(--acc);margin-bottom:calc(14*var(--u))}
.problem{font:600 calc(54*var(--u))/1.3 "IBM Plex Mono",monospace;color:${C.forest};background:#fff;border:2px solid ${C.line};border-radius:16px;padding:calc(32*var(--u)) calc(36*var(--u))}
.steps{list-style:none;counter-reset:s;display:flex;flex-direction:column;gap:calc(20*var(--u))}
.steps li{counter-increment:s;display:grid;grid-template-columns:calc(58*var(--u)) 1fr;gap:calc(22*var(--u));align-items:start;font-size:calc(40*var(--u));line-height:1.35}
.steps li::before{content:counter(s);width:calc(58*var(--u));height:calc(58*var(--u));border-radius:50%;background:var(--acc);color:#fff;font:700 calc(28*var(--u))/calc(58*var(--u)) Inter,sans-serif;text-align:center}
.answer{align-self:flex-start;background:${C.forest};color:#fff;border-radius:14px;padding:calc(22*var(--u)) calc(34*var(--u));font:600 calc(46*var(--u))/1.2 "IBM Plex Mono",monospace}
.answer span{display:block;font:600 calc(20*var(--u))/1 "IBM Plex Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:${C.goldSoft};margin-bottom:calc(10*var(--u))}
.tip{display:grid;grid-template-columns:calc(84*var(--u)) 1fr;gap:calc(28*var(--u));background:#fff;border:2px solid ${C.line};border-radius:18px;padding:calc(34*var(--u))}
.tip .num{width:calc(84*var(--u));height:calc(84*var(--u));border-radius:50%;background:var(--tint);color:var(--acc);font:800 calc(46*var(--u))/calc(84*var(--u)) Fraunces,serif;text-align:center}
.ican{font-family:Fraunces,serif;font-style:italic;font-weight:500;font-size:calc(54*var(--u));line-height:1.22;color:${C.forest}}
.quad{display:grid;grid-template-columns:1fr 1fr;gap:calc(18*var(--u))}
.quad div{background:#fff;border-radius:16px;border-top:calc(12*var(--u)) solid var(--q);padding:calc(28*var(--u)) calc(30*var(--u));box-shadow:0 1px 0 ${C.line}}
.quad b{display:block;font:800 calc(44*var(--u))/1.1 Fraunces,serif;color:${C.forest};margin-bottom:calc(10*var(--u))}
.quad span{font-size:calc(31*var(--u));line-height:1.3;color:${C.charSoft}}
.list{list-style:none;display:flex;flex-direction:column;gap:calc(14*var(--u))}
.list li{display:grid;grid-template-columns:calc(230*var(--u)) 1fr;align-items:baseline;background:#fff;border:2px solid ${C.line};border-radius:14px;padding:calc(20*var(--u)) calc(28*var(--u));font-size:calc(38*var(--u));font-weight:600;color:${C.forest}}
.code{font:600 calc(27*var(--u))/1 "IBM Plex Mono",monospace;color:var(--acc)}
.thumb{align-self:center;background:#fff;padding:calc(18*var(--u));border-radius:14px;box-shadow:0 18px 40px rgba(17,42,36,.18)}
.thumb img{display:block;max-width:calc(640*var(--u));max-height:calc(760*var(--u))}
footer{height:196px;background:${C.forest};display:grid;grid-template-columns:auto 1fr;align-items:center;gap:30px;padding:0 76px}
.mark{display:grid;grid-template-columns:40px 40px;gap:6px}
.mark i{display:block;width:40px;height:40px;border-radius:5px}
.dom{font:800 52px/1 Fraunces,serif;color:#fff;letter-spacing:-.01em}
.cta{font:600 29px/1.2 Inter,sans-serif;color:${C.goldSoft};margin-top:14px}
</style></head><body>
<div class="bar"></div>
<header><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1></header>
<main class="fit"><div class="inner">${body}</div></main>
<footer><div class="mark"><i style="background:${C.teal}"></i><i style="background:${C.gold}"></i><i style="background:${C.coral}"></i><i style="background:${C.navy}"></i></div>
<div><div class="dom">mathclass678.com</div><div class="cta">${esc(cta)}</div></div></footer>
<script>
window.fitPin = async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  const root = document.documentElement, h1 = document.querySelector('h1');
  for (let kt = 1; h1.offsetHeight > 92 * 3.2 * kt && kt > 0.62; kt -= 0.04) root.style.setProperty('--kt', (kt - 0.04).toFixed(2));
  const fit = document.querySelector('.fit'), inner = document.querySelector('.inner');
  let k = 1;
  while (inner.offsetHeight > fit.clientHeight && k > 0.56) { k -= 0.03; root.style.setProperty('--k', k.toFixed(2)); }
  return { ok: inner.offsetHeight <= fit.clientHeight, k, fonts: [...document.fonts].filter(f => f.status === 'loaded').length };
};
</script></body></html>`;
}

/* ------------------------------------------------------------------ rendering (Chrome DevTools protocol) */
async function renderAll(pins, dir) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mc678pins-'));
  const port = 9300 + Math.floor(Math.random() * 500);
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${tmp}/profile`, '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
  try {
    let target;
    for (let i = 0; i < 150 && !target; i++) {
      await new Promise(r => setTimeout(r, 200));
      try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
    }
    if (!target) throw new Error('Chrome did not start');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0; const waiting = new Map(), events = [];
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } else if (m.method) events.push(m.method); };
    const send = (method, params = {}) => new Promise(res => { const n = ++id; waiting.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 1500, deviceScaleFactor: 1, mobile: false });
    for (const [i, p] of pins.entries()) {
      const file = path.join(tmp, `${p.slug}.html`);
      fs.writeFileSync(file, p.html);
      events.length = 0;
      await send('Page.navigate', { url: 'file://' + file });
      for (let w = 0; w < 150 && !events.includes('Page.loadEventFired'); w++) await new Promise(r => setTimeout(r, 100));
      const r = await send('Runtime.evaluate', { expression: 'fitPin()', awaitPromise: true, returnByValue: true });
      const v = r.result?.result?.value;
      if (!v || !v.ok) throw new Error(`${p.slug} does not fit (${JSON.stringify(v)})`);
      if (v.fonts < 3) throw new Error(`${p.slug}: web fonts did not load`);
      const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 86, clip: { x: 0, y: 0, width: 1000, height: 1500, scale: 1 } });
      fs.writeFileSync(path.join(dir, `${p.slug}.jpg`), Buffer.from(shot.result.data, 'base64'));
      if ((i + 1) % 20 === 0) console.log(`  rendered ${i + 1}/${pins.length}`);
    }
    ws.close();
  } finally {
    chrome.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/* ------------------------------------------------------------------ main */
const plan = PLANS[BATCH];
if (!plan) { console.error(`No plan for batch ${BATCH}. Plans: ${Object.keys(PLANS).join(', ')}`); process.exit(1); }
if (!args.includes('--no-build')) execFileSync(process.execPath, [path.join(ROOT, 'build_site.js')], { stdio: 'ignore' });

const pins = interleave(pick(plan));
const when = schedule(pins.length, plan.start);
const BANNED = /!|written by|teacher-written|\bofficial\b|purple|[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}]/iu;
const PRICE = /\$\s?\d/;   // dollar amounts are fine inside math (examples, vocabulary, tips), never on product pins
for (const p of pins) {
  for (const f of ['title', 'desc', 'kw']) {
    const m = p[f].match(BANNED) || (['sheet', 'bundle', 'free'].includes(p.kind) && p[f].match(PRICE));
    if (m) throw new Error(`${p.slug} ${f}: "${m[0]}"`);
  }
  if (!p.board) throw new Error(`${p.slug}: no board`);
  if (/object Object|>undefined<|: undefined|\bNaN\b/.test(p.html + p.title + p.desc)) throw new Error(`${p.slug}: unfilled text`);
}
if (new Set(pins.map(p => p.link)).size !== pins.length) throw new Error('two pins share a link');
const counts = pins.reduce((a, p) => (a[p.kind] = (a[p.kind] || 0) + 1, a), {});
console.log(`${BATCH}: ${pins.length} pins ${JSON.stringify(counts)}, ${when[0]}Z to ${when.at(-1)}Z`);
if (DRY) { [...new Set(pins.map(p => p.board))].sort().forEach(b => console.log('  board: ' + b)); process.exit(0); }

const dir = path.join(ROOT, 'assets', 'pins', BATCH);
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
await renderAll(pins, dir);

const q = s => /[",\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : s;
const head = ['Title', 'Media URL', 'Pinterest board', 'Thumbnail', 'Description', 'Link', 'Publish date', 'Keywords'];
const rows = pins.map((p, i) => [p.title, `${SITE}/assets/pins/${BATCH}/${p.slug}.jpg`, p.board, '', p.desc, p.link, when[i], p.kw]);
fs.mkdirSync(path.join(ROOT, 'pinterest'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'pinterest', `${BATCH}.csv`), [head, ...rows].map(r => r.map(q).join(',')).join('\n') + '\n');
console.log(`wrote ${pins.length} images to assets/pins/${BATCH}/ and pinterest/${BATCH}.csv`);
[...new Set(pins.map(p => p.board))].sort().forEach(b => console.log('  board: ' + b));
