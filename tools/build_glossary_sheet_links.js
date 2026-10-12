#!/usr/bin/env node
/* Glossary term -> skill sheet links (v1.24.0 · 2026-10-12).

     node tools/build_glossary_sheet_links.js          write glossary_sheet_links.json
     node tools/build_glossary_sheet_links.js --check  verify only, write nothing

   Each glossary term page gets a "Teach it" band with the skill sheet(s) that teach the term, and each
   sheet page gets a "Key vocabulary" line back to its terms. The pairs are CHOSEN BY HAND below (PICKS),
   one line per term, best sheet first, at most two. The rules they follow:
     - same grade first, then an adjacent grade (5th -> 6th, 8th -> 8th or Algebra 1);
     - Algebra 1 terms -> Algebra 1 sheets; Geometry terms only where an 8th or Algebra 1 sheet clearly
       teaches the term (Pythagorean theorem, transformations, parallel lines and a transversal, ...);
     - a sheet is listed only when it teaches the term; generic words (data, product, operation) and
       topics no sheet teaches get no link. No link is better than a weak one.
   A term missing from PICKS gets no band. This script checks every pick (the term exists, the sheet exists,
   its TPT id is not in retired_ids.json, at most two, no repeats), flags any pick that shares neither a
   standard domain nor a word with the term, and writes glossary_sheet_links.json (term slug -> on-site sheet
   page paths), which build_site.js reads. Sheet keys: 1-103 = the grades 6-8 sheet number, A1-A99 = the
   Algebra 1 sheet code. */

'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'glossary_sheet_links.json');

const PICKS = `
# ---- 5th grade (no 5th sheets: 6th sheets only where one teaches the term)
powers-of-ten-grade-5: 16
multiply-whole-numbers-grade-5: 12
division-grade-5: 12
quotient-grade-5: 12
add-subtract-decimals-grade-5: 12
multiply-decimals-grade-5: 12
order-of-operations-grade-5: 1
parentheses-grade-5: 1
brackets-grade-5: 1
numerical-expression-grade-5: 1
evaluate-grade-5: 1
divide-with-fractions-grade-5: 11
line-plot-grade-5: 29
volume-grade-5: 32
cubic-unit-grade-5: 32
volume-formula-grade-5: 32
base-area-grade-5: 32
coordinate-plane-grade-5: 9
origin-grade-5: 9
x-axis-grade-5: 9
y-axis-grade-5: 9
ordered-pair-grade-5: 9
coordinate-grade-5: 9
plot-a-point-grade-5: 9

# ---- 6th grade
equivalent-ratios-grade-6: 6 4
part-to-part-ratio-grade-6: 4
part-to-whole-ratio-grade-6: 4
per-grade-6: 5
percent-grade-6: 41
rate-grade-6: 5
ratio-language-grade-6: 4
ratio-table-grade-6: 6
ratio-grade-6: 4
scale-factor-grade-6: 42
unit-price-grade-6: 5 6
unit-rate-grade-6: 5
greatest-common-factor-grade-6: 2
least-common-denominator-grade-6: 3
least-common-multiple-grade-6: 3
absolute-value-grade-6: 15
common-factor-grade-6: 2
common-multiple-grade-6: 3
coordinate-plane-grade-6: 9 14
coordinate-grade-6: 9
dividend-grade-6: 11 12
divisor-grade-6: 11 12
factor-grade-6: 2
inequality-grade-6: 26
integer-grade-6: 13
multiple-grade-6: 3
negative-number-grade-6: 13
opposite-grade-6: 13
ordered-pair-grade-6: 9
ordering-grade-6: 15
origin-grade-6: 9
positive-number-grade-6: 13
prime-factor-grade-6: 2
quadrant-grade-6: 9
quotient-grade-6: 64
rational-number-grade-6: 14 15
reciprocal-grade-6: 11
reflection-grade-6: 9
x-coordinate-grade-6: 9
y-coordinate-grade-6: 9
algebraic-expression-grade-6: 17 64
base-exponents-grade-6: 16
coefficient-grade-6: 64 17
constant-grade-6: 64
dependent-variable-grade-6: 23
distributive-property-grade-6: 20
equation-grade-6: 21 25
equivalent-expressions-grade-6: 24
evaluate-grade-6: 18
expand-grade-6: 20
exponent-grade-6: 16
expression-grade-6: 64 17
independent-variable-grade-6: 23
inverse-operation-grade-6: 21
like-terms-grade-6: 19
number-line-grade-6: 26 14
open-circle-grade-6: 26
order-of-operations-grade-6: 1
power-grade-6: 16
simplify-grade-6: 19
solution-grade-6: 25 21
substitute-grade-6: 18
substitution-grade-6: 24
table-grade-6: 23
term-grade-6: 64 19
variable-grade-6: 17 25
base-area-grade-6: 32
base-geometry-grade-6: 31
cubic-units-grade-6: 32
decompose-grade-6: 31
edge-length-grade-6: 32
face-grade-6: 101
height-grade-6: 31
horizontal-side-grade-6: 28 27
net-grade-6: 101
parallelogram-grade-6: 31
perimeter-grade-6: 28 27
polygon-grade-6: 28 31
prism-grade-6: 101 32
quadrilateral-grade-6: 27
surface-area-grade-6: 101
trapezoid-grade-6: 31
vertical-side-grade-6: 28 27
vertices-grade-6: 28 27
volume-grade-6: 32
box-plot-grade-6: 29
center-grade-6: 10
distribution-grade-6: 8
dot-plot-grade-6: 29
frequency-grade-6: 29
histogram-grade-6: 29
interquartile-range-grade-6: 10
mean-absolute-deviation-grade-6: 10
mean-grade-6: 30 10
measure-of-variation-grade-6: 10
median-grade-6: 30 10
non-statistical-question-grade-6: 7
quartile-grade-6: 29 10
range-grade-6: 10
shape-grade-6: 8
spread-grade-6: 8
statistical-question-grade-6: 7
variability-grade-6: 7 10

# ---- 7th grade
complex-fraction-grade-7: 38
constant-of-proportionality-grade-7: 40
origin-grade-7: 40
percent-grade-7: 41 54
percent-change-grade-7: 41
percent-decrease-grade-7: 41
percent-increase-grade-7: 41
proportional-relationship-grade-7: 40
rate-grade-7: 39
reciprocal-grade-7: 38
unit-rate-grade-7: 39
absolute-value-grade-7: 33 15
additive-inverse-grade-7: 53
common-denominator-grade-7: 37
difference-grade-7: 34
distance-grade-7: 34
dividend-grade-7: 36
divisor-grade-7: 36
fact-family-grade-7: 36
factor-grade-7: 2
integer-grade-7: 33
kcc-grade-7: 37
kcf-grade-7: 38
negative-rational-grade-7: 55
opposite-grade-7: 34 53
opposites-grade-7: 53
product-grade-7: 35
quotient-grade-7: 36
rational-number-grade-7: 54
reasonableness-grade-7: 55
repeated-addition-grade-7: 35
repeating-decimal-grade-7: 54
sign-rules-grade-7: 35 36
sum-grade-7: 33
terminating-decimal-grade-7: 54
zero-pair-grade-7: 53 33
center-grade-7: 59 60
certain-event-grade-7: 56
compound-event-grade-7: 52
dependent-events-grade-7: 52
distribution-grade-7: 59
equally-likely-grade-7: 56
estimate-grade-7: 58
event-grade-7: 50 56
experimental-probability-grade-7: 50
impossible-event-grade-7: 56
independent-events-grade-7: 52
inference-grade-7: 58 57
informal-comparative-inference-grade-7: 60 59
mean-absolute-deviation-mad-grade-7: 59 60
measure-of-center-grade-7: 60
measure-of-variability-grade-7: 60
non-uniform-probability-model-grade-7: 51
population-grade-7: 57
population-parameter-grade-7: 58
probability-grade-7: 56
probability-model-grade-7: 51
random-sample-grade-7: 57
relative-frequency-grade-7: 50
representative-grade-7: 57
sample-grade-7: 57
sample-space-grade-7: 51 52
sample-statistic-grade-7: 58
theoretical-probability-grade-7: 50
tree-diagram-grade-7: 52
uniform-probability-model-grade-7: 51
variability-grade-7: 58
visual-overlap-grade-7: 59
circumference-grade-7: 61
complementary-grade-7: 43
composite-figure-grade-7: 63
cross-section-grade-7: 62
decompose-grade-7: 63
degenerate-triangle-grade-7: 44
diameter-grade-7: 61
linear-pair-grade-7: 43
pi-grade-7: 61
plane-grade-7: 62
prism-grade-7: 62
proportional-grade-7: 42
pyramid-grade-7: 62
radius-grade-7: 61
range-of-the-third-side-grade-7: 44
scale-grade-7: 42
scale-drawing-grade-7: 42
scale-factor-grade-7: 42
supplementary-grade-7: 43
surface-area-grade-7: 63
triangle-inequality-theorem-grade-7: 44
valid-triangle-grade-7: 44
vertical-angles-grade-7: 43
volume-grade-7: 63
closed-circle-grade-7: 45
coefficient-grade-7: 48
constant-grade-7: 48
distributive-property-grade-7: 49
equivalent-expressions-grade-7: 46 49
estimation-grade-7: 47
greatest-common-factor-grade-7: 49 2
inverse-operations-grade-7: 67
like-terms-grade-7: 48
multi-step-problem-grade-7: 47
open-circle-grade-7: 45
order-of-operations-grade-7: 1
solution-grade-7: 67
solution-set-grade-7: 45
term-grade-7: 48
two-step-equation-grade-7: 67
two-step-inequality-grade-7: 45

# ---- 8th grade
consecutive-integers-grade-8: 84
irrational-number-grade-8: 68 84
perfect-square-grade-8: 81 84
rational-approximation-grade-8: 84
rational-number-grade-8: 68
repeating-decimal-grade-8: 68
terminating-decimal-grade-8: 68
decreasing-grade-8: 87
function-grade-8: 73
increasing-grade-8: 87
initial-value-grade-8: 86
input-grade-8: 73
linear-function-grade-8: 78 86
nonlinear-grade-8: 78 87
output-grade-8: 73
rate-of-change-grade-8: 86 85
relation-grade-8: 73
representation-grade-8: 85
slope-grade-8: 77
slope-formula-grade-8: 86 A35
turning-point-grade-8: 87
x-intercept-grade-8: 78
y-intercept-grade-8: 77 102
coefficient-grade-8: 70
constant-of-proportionality-grade-8: 79
constraint-grade-8: 103
context-check-grade-8: 66
cube-root-grade-8: 81
define-the-variable-grade-8: 66
define-variables-grade-8: 103
distributive-property-grade-8: 75
elimination-grade-8: 83
equation-grade-8: 75 66
identity-grade-8: 76
infinitely-many-grade-8: 76
integer-exponent-grade-8: 71 72
interpret-grade-8: 103
inverse-operation-grade-8: 75
isolate-grade-8: 82
lcd-grade-8: 65
like-base-grade-8: 71
like-terms-grade-8: 75
matching-exponents-grade-8: 74
negative-exponent-grade-8: 72
no-solution-grade-8: 76
origin-grade-8: 79
parallel-lines-grade-8: 80
perfect-cube-grade-8: 81
power-of-10-grade-8: 70
power-of-a-power-grade-8: 71
product-rule-grade-8: 71
proportional-relationship-grade-8: 79
quotient-rule-grade-8: 71
reciprocal-grade-8: 65
renormalize-grade-8: 74
rise-over-run-grade-8: 77
scientific-notation-grade-8: 70 74
slope-intercept-form-grade-8: 77
solution-grade-8: 75 76
solution-of-a-system-grade-8: 80
square-root-grade-8: 81
standard-form-grade-8: 70
substitution-grade-8: 82
system-of-equations-grade-8: 80 82
unit-rate-grade-8: 79
zero-exponent-grade-8: 72
acute-obtuse-grade-8: 88
alternate-interior-angles-grade-8: 95
angle-of-rotation-grade-8: 91
axis-of-reflection-grade-8: 90
clockwise-counterclockwise-grade-8: 91
center-of-dilation-grade-8: 92
center-of-rotation-grade-8: 91
co-interior-angles-grade-8: 95
composition-grade-8: 93
cone-grade-8: 98
congruent-grade-8: 93
converse-grade-8: 88
coordinates-grade-8: 97
corresponding-grade-8: 95
cylinder-grade-8: 98
dilation-grade-8: 92
distance-grade-8: 97
double-prime-grade-8: 93
hypotenuse-grade-8: 96 88
image-grade-8: 89
leg-grade-8: 96
legs-grade-8: 97 96
preimage-grade-8: 89
pythagorean-theorem-grade-8: 96 88
reflection-grade-8: 90
rigid-motion-grade-8: 93
rotation-grade-8: 91
scale-factor-grade-8: 92
similar-figures-grade-8: 94
sphere-grade-8: 98
translation-grade-8: 89
transversal-grade-8: 95
vector-grade-8: 89
volume-grade-8: 98
association-grade-8: 99
conditional-frequency-grade-8: 69
joint-frequency-grade-8: 69
linear-model-grade-8: 102 100
line-of-best-fit-grade-8: 100
marginal-frequency-grade-8: 69
model-fit-grade-8: 100
outlier-grade-8: 99
prediction-grade-8: 102 100
residual-grade-8: A98
scatter-plot-grade-8: 99
two-way-table-grade-8: 69

# ---- Algebra 1
coefficient-algebra: A7
constant-algebra: A7
multi-step-equation-algebra: A11
distributive-property-algebra: A5
equation-algebra: A9
expression-algebra: A7 A6
inverse-operation-algebra: A9
isolate-the-variable-algebra: A9 A16
like-terms-algebra: A5
literal-equation-algebra: A16
simplify-algebra: A5
solution-algebra: A9
term-algebra: A7 A5
variable-algebra: A6 A3
variables-on-both-sides-algebra: A12
absolute-value-equation-algebra: A18
absolute-value-inequality-algebra: A22
and-intersection-algebra: A21
closed-circle-algebra: A19
compound-inequality-algebra: A21
flip-the-inequality-algebra: A20
inequality-algebra: A19
open-circle-algebra: A19
or-union-algebra: A21
solution-set-algebra: A19 A21
arithmetic-sequence-algebra: A52 A54
common-difference-algebra: A52
common-ratio-algebra: A53
domain-algebra: A26
evaluate-a-function-algebra: A29
function-algebra: A26 A27
function-notation-algebra: A28
geometric-sequence-algebra: A53 A54
input-and-output-algebra: A29 A26
range-algebra: A26
relation-algebra: A26
sequence-algebra: A52 A54
direct-variation-algebra: A42
linear-function-algebra: A36 A43
parallel-lines-algebra: A41
perpendicular-lines-algebra: A41
point-slope-form-algebra: A38
rate-of-change-algebra: A34
slope-algebra: A34 A35
slope-intercept-form-algebra: A36 A37
standard-form-algebra: A39
x-intercept-algebra: A39
y-intercept-algebra: A36 A39
elimination-method-algebra: A49
solving-by-graphing-algebra: A47
infinitely-many-solutions-algebra: A50
linear-inequality-graph-algebra: A24
no-solution-algebra: A50
solution-of-a-system-algebra: A47
substitution-method-algebra: A48
system-of-equations-algebra: A47 A50
base-algebra: A55
binomial-algebra: A67 A69
degree-algebra: A67
exponent-algebra: A55
foil-method-algebra: A69
leading-coefficient-algebra: A67
monomial-algebra: A67
negative-exponent-algebra: A56
polynomial-algebra: A67
power-of-a-power-algebra: A55
product-rule-algebra: A55
quotient-rule-algebra: A55
scientific-notation-algebra: A60
trinomial-algebra: A67
zero-exponent-algebra: A56
difference-of-squares-algebra: A75
factor-algebra: A72 A78
factoring-trinomials-algebra: A73 A74
greatest-common-factor-algebra: A72
perfect-square-trinomial-algebra: A76
prime-not-factorable-algebra: A78
zero-product-property-algebra: A87
axis-of-symmetry-algebra: A80 A79
completing-the-square-algebra: A89 A82
discriminant-algebra: A91
parabola-algebra: A79 A80
quadratic-formula-algebra: A90
quadratic-function-algebra: A79
vertex-algebra: A80 A81
vertex-form-algebra: A81
zeros-roots-algebra: A83 A87
correlation-algebra: A99
correlation-vs-causation-algebra: A99
exponential-decay-algebra: A63
exponential-function-algebra: A61
exponential-growth-algebra: A62
growth-factor-algebra: A62 A63
linear-vs-exponential-algebra: A65
line-of-best-fit-algebra: A97
scatter-plot-algebra: A97
slope-in-context-algebra: A44

# ---- Geometry (only where an 8th grade or Algebra 1 sheet teaches the term)
parallel-lines-geometry: 95
transversal-geometry: 95
corresponding-angles-geometry: 95
alternate-interior-angles-geometry: 95
alternate-exterior-angles-geometry: 95
co-interior-angles-geometry: 95
similar-figures-geometry: 94
scale-factor-geometry: 92
pythagorean-theorem-geometry: 96 88
hypotenuse-geometry: 96
leg-geometry: 96
translation-geometry: 89
reflection-geometry: 90
rotation-geometry: 91
dilation-geometry: 92
rigid-motion-geometry: 93
pre-image-and-image-geometry: 89
composition-of-transformations-geometry: 93
center-of-rotation-geometry: 91
distance-formula-geometry: 97
slope-geometry: A35 A34
parallel-slopes-geometry: A41
perpendicular-slopes-geometry: A41
volume-of-a-cylinder-geometry: 98
volume-of-a-cone-geometry: 98
volume-of-a-sphere-geometry: 98
`;

/* ---- minimal CSV reader (same rules as build_site.js) ---- */
function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\r') {}
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
}
function csv(file) {
  const rows = parseCSV(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  const hdr = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => { const o = {}; hdr.forEach((h, i) => o[h] = (r[i] || '').trim()); return o; });
}
const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const words = s => new Set(String(s).toLowerCase().replace(/\([^)]*\)/g, ' ').split(/[^a-z0-9]+/)
  .map(w => w.replace(/(ies)$/, 'y').replace(/(s)$/, '')).filter(w => w.length > 2 && !STOP.has(w)));
const STOP = new Set(['the', 'and', 'with', 'from', 'for', 'grade', 'math', 'number', 'numbers', 'two', 'one', 'into', 'its', 'that']);

/* ---- the sheets: grades 6-8 (page slug rule as build_site.js) and Algebra 1 ---- */
const SS = JSON.parse(fs.readFileSync(path.join(ROOT, 'skillsheet_data.json'), 'utf8'));
const sheets = {};
const six8 = csv('Master_Catalog_Skills.csv').map(r => {
  const name = r.SkillName.replace(/\s*\(\s*\d?(st|nd|rd|th)?\s*[—-]?\s*FREE\s*\)/i, '').replace(/\s*—\s*FREE/i, '').trim();
  const v = SS.by_num[r.SheetNumber];
  return { key: r.SheetNumber, name, slug: slugify(name), grade: (r.Grade.match(/\d/) || [])[0],
    codes: [...new Set([r.CCSS.split('-')[0].trim(), ...v.codes])], id: String(v.listing_id), live: /SHIPPED/i.test(r.Status) };
});
const cnt = {}; six8.forEach(s => { cnt[s.slug] = (cnt[s.slug] || 0) + 1; });
six8.forEach(s => { s.path = `/sheets/${cnt[s.slug] > 1 ? `${s.slug}-grade-${s.grade}` : s.slug}.html`; sheets[s.key] = s; });
const A1 = JSON.parse(fs.readFileSync(path.join(ROOT, 'classroom_data.json'), 'utf8')).algebra1;
A1.units.forEach(u => u.sheets.forEach(x => {
  const v = SS.alg1.by_code[x.code];
  sheets[x.code] = { key: x.code, name: x.skill, grade: 'A1', codes: v.codes, id: String(v.listing_id), live: true,
    path: `/algebra-1/${x.slug}.html`, unit: u.name };
}));

/* ---- the terms ---- */
const FILES = { '5th': '5th', '6th': '6th', '7th': '7th', '8th': '8th', Algebra: 'Algebra', Geometry: 'Geometry' };
const terms = {};
Object.keys(FILES).forEach(g => csv(`WordWall_Content_${FILES[g]}_MASTER.csv`).forEach(r => { if (r.slug) terms[r.slug] = Object.assign(r, { grade: g }); }));

const retired = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'retired_ids.json'), 'utf8')).ids));
const errors = [], flags = [], links = {};
const domain = c => String(c).replace(/^HS/, '').replace(/^([A-Z]+)[-.]/, '$1.').split('.').slice(0, 2).join('.');   // 6.EE, 8.G, N.RN, F.IF, G.CO
PICKS.split('\n').map(l => l.replace(/#.*/, '').trim()).filter(Boolean).forEach(line => {
  const m = line.match(/^([a-z0-9-]+):\s*(.+)$/);
  if (!m) { errors.push(`bad line: ${line}`); return; }
  const [, slug, rest] = m, keys = rest.split(/\s+/);
  const t = terms[slug];
  if (!t) { errors.push(`${slug}: no such glossary term`); return; }
  if (links[slug]) { errors.push(`${slug}: listed twice`); return; }
  if (keys.length > 2) errors.push(`${slug}: more than two sheets`);
  if (new Set(keys).size !== keys.length) errors.push(`${slug}: the same sheet twice`);
  links[slug] = keys.map(k => {
    const s = sheets[k];
    if (!s) { errors.push(`${slug}: no sheet ${k}`); return null; }
    if (!s.live) errors.push(`${slug}: sheet ${k} is not shipped`);
    if (retired.has(s.id)) errors.push(`${slug}: sheet ${k} (${s.id}) is a retired TPT listing`);
    // sanity: the pick should share a standard domain or a word with the term
    const tCodes = (t.all_ccss || t.primary_ccss || '').split(';').map(x => x.trim()).filter(Boolean);
    const sharesDomain = tCodes.some(c => s.codes.some(sc => domain(sc) === domain(c)));
    const tw = words(`${t.term} ${t.definition} ${t.key_rule}`), sw = words(`${s.name} ${s.unit || ''}`.replace(/[()]/g, ' '));
    if (!sharesDomain && ![...sw].some(w => tw.has(w))) flags.push(`${slug} -> ${k} ${s.name} (no shared domain or word: check)`);
    return s.path;
  }).filter(Boolean);
});

const byGrade = {};
Object.values(terms).forEach(t => { const g = byGrade[t.grade] = byGrade[t.grade] || [0, 0, 0]; g[(links[t.slug] || []).length]++; });
console.log('Terms with 0 / 1 / 2 sheet links:');
Object.entries(byGrade).forEach(([g, c]) => console.log(`  ${g.padEnd(9)} ${c.join(' / ')}`));
const tot = Object.values(byGrade).reduce((a, c) => a.map((x, i) => x + c[i]), [0, 0, 0]);
console.log(`  ${'all'.padEnd(9)} ${tot.join(' / ')}   (${Object.keys(terms).length} terms)`);
const used = new Set(Object.values(links).flat());
console.log(`Sheets linked from at least one term: ${used.size} of ${Object.keys(sheets).length}`);
flags.forEach(f => console.log('  check: ' + f));
if (errors.length) { console.error('ERRORS:\n  ' + errors.join('\n  ')); process.exit(1); }

if (!process.argv.includes('--check')) {
  const sorted = {}; Object.keys(links).sort().forEach(k => { sorted[k] = links[k]; });
  fs.writeFileSync(OUT, JSON.stringify({
    _about: 'Glossary term slug -> on-site skill sheet pages that teach it, best first, at most two. Generated by tools/build_glossary_sheet_links.js from its hand-chosen PICKS; edit the picks there and re-run, not this file. build_site.js reads it for the "Teach it" band on term pages and the "Key vocabulary" line on sheet pages.',
    links: sorted }, null, 1) + '\n');
  console.log(`Wrote ${path.relative(ROOT, OUT)} (${Object.keys(sorted).length} terms)`);
}
