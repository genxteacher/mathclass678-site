# MC678 Website — Claude Code Project Memory

This file is read automatically by Claude Code at the start of every session in this
repo. It carries the same permanent doctrine that used to get pasted into claude.ai at
the top of each chat session. You should not need to re-paste this anywhere — Claude Code
sees it on its own.

For **current session state** (what's deployed, what's in progress, open action items),
see `PASTEBLOCK.md` in this same repo root — read that too, every session. Unlike this
file, PASTEBLOCK.md is expected to change constantly and gets overwritten at the end of
every session with a fresh handoff for the next one.

---

## Structural rules only

Session state lives in `PASTEBLOCK.md`, not here. This file changes only when
fundamental doctrine changes — not session to session. Sibling project to the MC678
build project. This project does NOT build skill sheets — it builds mathclass678.com.

**Oct 12 2026 — NO EMAIL COLLECTION.** Kit (formerly ConvertKit) is removed from the site
entirely (owner decision: possible TPT exclusivity issues, no subscribers). No email
collection; freebies link to their free TPT listings (Oct 12 2026, owner decision). The
build's NO-EMAIL GATE (end of `build_site.js`) fails if `kit.com`, `ck.page`,
`convertkit`, `formkit`, a Kit `data-uid` embed, an email input, or a form posting to an
external host reaches `dist/`. Never add an email form, mailing-list embed or signup band
back without Greg explicitly asking. Claude Code can push directly; GitHub Desktop
remains a fallback.

**Oct 12 2026 — RETIRED PRODUCT LINES.** Greg deactivated 158 TPT listings, mostly whole lines at
once: interactive notebooks / foldables, Money Labs / consumer math (Consumer Math Essentials
bundle), activity packs / mazes / escape room, anchor charts and posters (Real Life Uses,
Growth Mindset, Standards for Mathematical Practice, the free CLT and Pythagorean anchor
charts), the paid Emergency Sub Plans (6th, 7th, 8th, bundle), EVERY word wall (whole-grade
walls, MEGA and Complete bundles, the six free 3-card samplers, the free 80-card set),
Mystery Pictures (digital and pixel art, all) and Mistake of the Week (bundle + 6th/7th/8th;
the free MOTW sampler 17672163 too), plus the free 6th/7th Math About Me, the Math About Me
hexagon display and the free Tennessee personal finance I Can sample. Their pages
(/sub-plans, /activity-packs, /mistake-of-the-week, /money-labs + 10 labs, /mystery-pictures,
five /free/ pages) are gone and 301 in `_redirects` (`RETIRED_LINE_REDIRECTS`). The free
3-day sub plan (16214563) is still live and sits on /free.html. The glossary stays (free
reference content, URLs under /word-wall/ unchanged) but is labelled "Glossary" and never
links to a word wall product. `retired_ids.json` (repo root) lists every retired TPT id; the
RETIRED-ID GATE at the end of `build_site.js` fails the build if dist links to any of them.
Never bring one of these lines back to the site unless Greg relists it on TPT; when more
listings are deactivated, add their ids to `retired_ids.json`.

**Oct 29 2026 — GRADES 5-8 SELL BY UNIT.** Every grade 5-8 now sells on TPT as one download per unit (the
unit's lessons with homework, plus the quiz, unit review and Unit Test Forms A and B), the year curriculum bundle,
a free pacing guide and one free lesson. The 6-8 single skill sheet listings and every skill sheet bundle were
deactivated, so /sheets/* and /bundles/* are gone and 301 (SHEET_BUNDLE_REDIRECTS: each sheet to the unit page that
teaches that lesson, each bundle to its grade). Pages: /5th-grade.html, /grade-6.html, /grade-7.html, /grade-8.html
(hubs) and /<5th-grade|grade-N>/unit-<n>-<slug>.html, built from classroom_data.json `curricula` (state-testing
tools/site_export/mc678_curricula.py STORE_JSON PAGES_JSON, which also writes live_ids.json and the Algebra 1 live
prices + homework facts). Algebra 1 still sells lesson by lesson, by unit bundle and as the curriculum bundle.
LIVE-ID GATE: the build fails if dist links a TPT id missing from live_ids.json; re-run the exporter after any
listing change. The Middle School Math ULTIMATE bundle (16515388) is still live on TPT but is not shown here.

## Who / what

Greg — 25+ yr middle-school math teacher, sole operator of Math Class 678 (TPT storefront
math-class-678). Building mathclass678.com as a branded catalog hub for the
math curriculum (5th-8th grade by unit, Algebra 1 by lesson, unit and year; see the Oct 29 2026 note above), plus a
free math vocabulary glossary (the former Word Wall branch, grades 5–8 + Algebra 1 +
Geometry; the word wall products were retired Oct 12 2026) and
free-resource pages that link to each freebie's free TPT listing. The site collects no
email addresses.

The site is a SHOWCASE + LINK-OUT hub. It sells nothing on-site. Every product button
routes to the matching TPT listing. No checkout, no payments, no e-commerce.

Greg has zero web-development background. This is a CUSTOM-CODED site that Claude
builds end-to-end. Claude owns the code; Greg does NOT edit source files directly.
Every content/design change runs through Claude, who now edits files directly in this
repo and pushes via git (Claude Code), or — as a fallback if Claude Code isn't available
in a given session — provides files for Greg to commit via GitHub Desktop.

Brand: forest green #1A3C34 · gold #D4A017
Grade accents: teal #3FA9A2 (6th) · coral #D85D5D (7th) · navy #2A4A7F (8th)
NEVER PURPLE. No emojis in site copy. No exclamation points in product-facing copy.
$ glyph permitted site-wide. Contact: tpt@mathclass678.com / support@mathclass678.com
Social: Pinterest @mathclass678 · Instagram @mathclass.678 · TikTok @mathclass678
TPT store: https://www.teacherspayteachers.com/store/math-class-678

## Stack (locked — S0 decision, GitHub migration S9, Claude Code direct push added S13)

Custom static site → GitHub → Netlify auto-deploy.

Build approach: vanilla HTML + CSS + JavaScript, generated from a Node script
(`build_site.js`). No runtime framework (no React/Vue). Client-side catalog filtering in
plain JS. Lightweight, fast, accessible, maintainable.

Generator: `build_site.js` reads, from repo root: `Master_Catalog_Skills.csv` +
`ICan_Statements_Master.csv` + `mc678_site_links.json` (link authority for Word Wall
cards + free resources) + the four `WordWall_Content_[grade]_MASTER.csv` files (6th,
7th, 8th, Algebra) + all inline content, and emits a flat `dist/` of static files.
Regenerate the whole site each session — no hand-patched output. Zero npm dependencies
(pure Node.js fs/path). **Every file the generator reads must physically exist in this
repo** — this is now trivially true since you're working directly in the repo, but it
was the source of a lost deploy cycle back in S12 when files existed only in the old
claude.ai project and never made it here. Watch for the same failure mode in reverse: if
Greg or a past claude.ai session produced a new CSV that hasn't been committed here yet,
that's the first thing to check before assuming a build failure is a code bug.

Fonts: Fraunces (display/headings) + Inter (body) + IBM Plex Mono (CCSS codes) via
Google Fonts `<link>`. No JS framework, fully static.

Repo: `mathclass678-site` (private GitHub repo, connected S9). This is the repo you are
in right now.

Hosting: Netlify — auto-deploys on every push to `main`. Build command:
`node build_site.js`. Publish directory: `dist`. Node version: 18 (set in `netlify.toml`).

Domain: mathclass678.com via Namecheap. Netlify provides free HTTPS.

**Deploy workflow, now that you're running in Claude Code:**
1. Edit source files directly in this repo.
2. Run `node build_site.js` and inspect `dist/` — this is the QA step, do it before
   committing, not after.
3. Run through the QA checklist below.
4. `git add`, `git commit` with a descriptive message, `git push origin main`.
5. Netlify detects the push and publishes in ~60 seconds. Tell Greg to hard-refresh to verify.

Drag-deploy is retired — never relevant in this workflow. Manual GitHub Desktop commits
are only a fallback for sessions that happen back in the claude.ai project instead of here.

What `netlify.toml` (repo root) does: sets build command + Node version.
What `dist/netlify.toml` (written by build script) does: sets 404 redirect rules.
These are two separate files; both are necessary — don't consolidate them.

## Skill sheet catalog authority

`Master_Catalog_Skills.csv` (103 rows) is site catalog ground truth — columns:
`SheetNumber, Grade, SkillName, CCSS, Bundle, Status, TPT_URL`.

Live-gating rule: `Status` field contains "SHIPPED" = live → "View on TPT" button.
`Status` does not contain "SHIPPED" = pending → "Coming soon" or omit. Never ship a dead
or placeholder link under any circumstances.

All 103 sheets are currently SHIPPED/live. The generator handles future pending rows
gracefully if any appear.

`ICan_Statements_Master.csv` — source for product-card descriptions. Match by `TPT_URL`
(`icanByUrl` lookup). Source = "authored" rows are Algebra 1 bell ringers — skip them.
12 sheets without a URL match have `DESC_OVERRIDE` entries in `build_site.js`.

`MathClass678_Deliverable_Link_Map.xlsx` — the human-maintained master link workbook
covering every TPT deliverable across every product line (774 items). `mc678_site_links.json`
is the machine-readable extraction of this workbook's live hyperlinks, and is what
`build_site.js` actually reads. If Greg adds or changes a deliverable, the workbook is
where that change originates; the JSON needs re-extracting afterward (no automated
pipeline exists for this yet — treat as a manual step each time until one is built).

`TPT_Arc_Tracker.md` — live vs pending (build project tracker, kept here for reference).
`TPT_Listing_Reference.md` — voice/tone reference; site copy matches this register.
`MOTW_content_master.csv` — not used: Mistake of the Week was retired Oct 12 2026.

Product names on site = exact `SkillName` from CSV (`nameClean` strips FREE
parentheticals for display; `slugify` normalizes for filenames). CCSS shown as clean
leaf codes only (strip facet tags: split on first hyphen, take left side).

Catalog counts (confirmed S9): 6th 34 · 7th 32 · 8th 37 · Total 103
Freebies (skill sheets): #19 Combining Like Terms (6th) · #48 Combining Like Terms (7th)
Free resources (non-skill-sheet): 11 items in `FREE_RESOURCES` array — all route to `/free.html`
(Oct 12 2026: the two anchor charts, six word wall samplers, the 80-card word wall and the 6th/7th Math About Me retired)
Bundles: 30 total (all live, all URLs confirmed) — strand · topic · MEGA · ULTIMATE tiers
Strands present: EE · NS · RP · SP · G · F

Two entry points for the freebies: the `/free.html` hub and 13 individual pages at
`/free/{slug}.html` (18 until Oct 12 2026; the CLT poster, Pythagorean poster, 80-card
word wall and 6th/7th Math About Me pages now 301 to /free.html) (kept for the URLs
that Pinterest and older links point to). Both link straight to the freebie's free TPT
listing. The site never hosts or serves the freebie files itself (TPT exclusivity).

## Glossary / Word Wall content authority

Four CSVs are the content ground truth for the Word Wall / glossary branch:
`WordWall_Content_5th_MASTER.csv` · `WordWall_Content_6th_MASTER.csv` ·
`WordWall_Content_7th_MASTER.csv` · `WordWall_Content_8th_MASTER.csv` ·
`WordWall_Content_Algebra_MASTER.csv` · `WordWall_Content_Geometry_MASTER.csv`.

Status: content-complete and LIVE in code — 6th/7th/8th/Algebra shipped S12, and
5th grade + Geometry wired in and shipped S14. All six branches are built into
`build_site.js` and deployed — this is doctrine, not a pending decision.

Counts: 5th grade 67 terms · 6th grade 106 terms · 7th grade 110 terms ·
8th grade 113 terms · Algebra 1 98 terms · Geometry 109 terms · 603 terms total,
each a unique, deduplicated, canonical glossary entry. 5th (CCSS 5.NBT/5.NF/…) and
Geometry (CCSS HSG-*) are CCSS-keyed like 6th–8th, but because the on-site catalog
is grades 6–8 only, no skill sheets/standards/bundles match their standards — so
their "Where this shows up" uses the product-light domain/topic-name fallback (the
Algebra unit-name exception, generalized). Grade accents: 5th = forest (--forest),
Geometry = slate (--slate) — added S14, never purple.

Column schema (identical across all six files): `slug`, `term`, `grade`,
`primary_ccss` (populated for 5th/6th/7th/8th/Geometry, blank for Algebra), `all_ccss`
(same, `;`-separated), `strand` (primary strand for CCSS-keyed grades, the Geometry
*topic* name, or the Algebra *unit* name — the join key for the product-light branches,
not a CCSS strand), `all_strands` (`;`-separated),
`merged` (YES if this canonical entry absorbed multiple source cards), `definition`,
`example_1`, `example_2`, `key_rule`, `memory_hook`, `related_terms` (2–4 sibling slugs),
`content_status` (DONE for every shipped row), `source_cards`.

**Content-authoring pipeline** (established, reusable for any remaining grades/strands)
is a claude.ai-project workflow, not something Claude Code needs to run: Greg uploads
a zip of card PNGs there, Claude OCRs via pytesseract, authors the enriched CSV row per
card, cross-references CCSS lineage, deduplicates (MERGE/SPLIT judgment below), and the
resulting master CSV gets committed to this repo. If you're asked to extend the glossary
content itself (not just build it into the site), that work happens in the claude.ai
project — this repo is where the finished CSV lands afterward.

**Content enrichment policy** — locked as "option (b)": glossary content may go slightly
beyond the bare card (e.g. a second example, a related-terms list) where it strengthens
the page for teacher usefulness and SEO, but the definition, key rule, and memory hook
always match the shipped card's own wording — never invented from general knowledge.

**Deduplication policy** — MERGE vs. SPLIT, decided per case:
- MERGE when the same concept is taught under more than one standard (6th–8th) or one
  unit (Algebra). One canonical page, `all_ccss`/`all_strands` lists every context.
  Shipped examples: Reciprocal (7th, RP+NS), Slope and Y-Intercept (8th, EE+F+SP),
  Square Root (8th, EE+G).
- SPLIT when two cards share an English word but teach genuinely different concepts —
  a true homonym. Shipped example: 6th grade Base — "Base (Exponents)" vs.
  "Base (Geometry)."
- Cross-grade duplicates are never merged — each grade/Algebra gets its own canonical
  page (`term-grade-6`, `term-grade-7`, `term-algebra`), cross-linked via "Same term,
  other grades."

**IP protection policy — never negotiable:** glossary pages never display the actual
Word Wall card image or PDF. The card's teaching content is read from the card and
re-expressed as native brand-styled HTML/SVG; the card's polished, print-ready,
four-format design was the product sold on TPT (retired Oct 12 2026; the policy stands).

## Site structure (v1.6.0 — built S14)

18 total pages that matter for your day-to-day work here, plus generated pages:
`index.html`, `catalog.html`, `bundles.html`, `word-wall.html`, `free.html`,
`about.html`, `contact.html`, `get-started.html`, `grade-6/7/8.html`, `404.html`.

Generated from `build_site.js`: `/sheets/{slug}.html` (103) · `/bundles/{slug}.html` (30)
· `/standards/{slug}.html` (93) · `/word-wall/{slug}.html` (603) · `/free/{slug}.html` (13,
each links to that freebie's free TPT listing; not linked from nav or `/free.html`).

Slug collision handling: two "Combining Like Terms" sheets (#19, #48), their matching
glossary terms, and their matching freebie pages all get grade suffixes:
`combining-like-terms-grade-6` / `combining-like-terms-grade-7`.

## Word Wall / glossary branch — architecture (live, built S12)

Positioning: not a product catalog — a free math glossary. (Until Oct 12 2026 it also sold
the print-ready Word Wall cards; that line is retired, so term pages now point to /free.html
and the hub's closing band to the skill sheet catalog. Nav/footer/breadcrumb label: "Glossary".) Individual term pages target long-tail search and are the
single largest evergreen SEO surface on the site.

Dual-key architecture: 5th/6th/7th/8th/Geometry are CCSS-keyed (`glossaryByCcss`,
many-to-many on `all_ccss`); Algebra is unit-keyed (`glossaryByUnit` on `strand`, 9
units). 5th and Geometry (added S14) are CCSS-keyed but product-light: no 6–8 catalog
product matches their standards, so their "Where this shows up" falls back to the
domain (5th) / topic (Geometry) name rather than sheet/standard/bundle cross-links.
`isCcssKeyed` is still literally `grade !== 'Algebra'` — Algebra is the only branch with
no CCSS at all. Grade labels come from `glossGradeLabel()` ("Geometry" and "Algebra 1"
are named; the rest are "Nth Grade"); accents in `GLOSSARY_ACCENT` (5th forest, 6th teal,
7th coral, 8th navy, Algebra gold, Geometry slate).

Four rendering spots — three built, one deferred: glossary term page itself (built,
"Where this shows up" + related terms + cross-grade links), standards page retrofit
(built, "Key vocabulary" chips), sheet page retrofit (built; since v1.24.0 the "Key vocabulary" line on 6-8 AND Algebra 1
sheet pages is the reverse of `glossary_sheet_links.json`, at most 6 terms), bundle
page retrofit ("Key terms in this bundle" — **deferred twice now for
injection-risk/lower-value reasons; pick up only if Greg asks**).

Glossary → skill sheet links (v1.24.0): each term page's "Teach it" band lists the sheet(s)
that teach the term, from `glossary_sheet_links.json` (term slug → on-site sheet page paths, best
first, at most 2). That file is generated by `tools/build_glossary_sheet_links.js` from the
hand-chosen pairs in its PICKS table: edit the picks and re-run, never the JSON. No link is better
than a weak one; when a sheet is retired, take it out of the picks.

Schema: `DefinedTerm`/`DefinedTermSet` JSON-LD. Never ship a term page whose "Where this
shows up" section is empty. The product-light variant is the general escape hatch: when no
sheet/standard/bundle resolves, the page shows the unit/domain/topic name instead — Algebra
(no CCSS at all), plus 5th and Geometry (CCSS but no matching 6–8 catalog product) all rely
on this. The CCSS branch itself now carries the fallback, so any orphan 6–8 term is covered
too. Never let a future edit drop the fallback and reintroduce an empty section.

## Freebies — no email collection (Oct 12 2026, owner decision)

No email collection; freebies link to their free TPT listings (Oct 12 2026, owner
decision). Kit was removed entirely: no embeds, scripts, form uids, signup bands, or
"sign up / no spam / unsubscribe" wording anywhere. Each `/free/{slug}.html` page keeps its
URL and descriptive copy and shows a "Get it free on TPT" button to that freebie's FREE
TPT listing (`tpt_url` from `free_resources` in `mc678_site_links.json`). The homepage and
every sheet page carry a `freeHero()` block, and `/get-started.html` is a simple page,
both pointing to the free Order of Operations listing (`FREE_OOO_URL`) plus `/free.html`.
A new freebie needs only a free TPT listing and its `free_resources` entry; no form.
The NO-EMAIL GATE at the end of `build_site.js` enforces this on every build.

## Image asset model

All images live in this repo — no re-upload of image zips needed, ever, now that you're
working here directly.

- Product thumbnails (103): `assets/images/thumbs/thumb1_[grade]th_[slug].jpg` (or `.png`)
- Bundle thumbnails (30): `assets/images/bundles/`, named per `BUNDLES` array `thumb` field
- Freebie thumbnails (12): `assets/images/freebies/free_[key].jpg`
- Site asset images: `assets/images/` — see `Site_Build_Log.md` for the full filename
  manifest, including three S12 images that are `.png` rather than the site's usual
  `.jpg` (source files came from ChatGPT as PNG; code was written to match rather than
  asking Greg to convert — extension discipline matters, don't rename without re-encoding).

Glossary pages never use product art — brand tiles/quadrant mark only (IP policy above).

## Build → QA checklist (run before every commit)

- Brand-color compliance: NEVER PURPLE, anywhere.
- No emojis, no exclamation points in product-facing copy.
- CCSS clean-leaf codes only (6th–8th); Algebra glossary uses unit names, never a
  forced CCSS code.
- Exact `SkillName` match from CSV; product names never invented or paraphrased.
- All links valid and live-gated — never a dead or placeholder link.
- Mobile-responsive — check a narrow viewport.
- Accessibility: alt text on every image, sufficient contrast, semantic HTML,
  keyboard-navigable.
- No console errors.
- No email collection: the build's NO-EMAIL GATE must report clean (no Kit/ConvertKit,
  no email inputs, no forms posting off-site).
- For any script involving a third-party embed's success/error state: verify it gates on
  a real user action first — never trust a presence-only DOM check against a third
  party's markup.
- Confirm every file `build_site.js` reads is actually present in this repo — not just
  referenced in a past claude.ai session.

## Design + copy rules (site-wide)

Aesthetic: striking, modern, professional — distinctive type, generous whitespace,
brand-tokened color, considered hover/transition states. Not generic-template.

Signature element: the four-quadrant 4-in-1 mark — teal (top-left) / gold (top-right) /
coral (bottom-left) / navy (bottom-right). Never remove or alter it. Also the fallback
art for glossary pages — never a card image.

Typography (locked S1): Fraunces (display) · Inter (body) · IBM Plex Mono (CCSS codes /
data labels), all via Google Fonts `<link>`, no JS.

Tone: confident, practical, teacher-to-teacher, matching `TPT_Listing_Reference.md`. No
hype, no filler superlatives, no exclamation points in product copy. Price never shown
on-site — all purchase paths route to TPT.

## Standing notes / open backlog

- Broader Algebra skill-sheet-catalog expansion — open, unscheduled, not a mandated opener.
- Bundle-page glossary retrofit — deferred twice, pick up only if Greg asks.
- 5th grade — fully deferred until Greg publishes 5th-grade cards + uploads zips (that
  intake still happens in the claude.ai project, not here).
- `TPT_RATING = null` in `build_site.js` — AggregateRating schema dormant until Greg
  provides real store-wide rating + review count. 3 real attributed reviews (Lauren K.,
  Megan T., Rachel B.) already emit as `Review`/`Rating` JSON-LD regardless.
- TPT storefront copy corrections ("103 sheets / $505", TikTok handle) are Greg's
  actions, not code changes — just don't forget to ask if they're done when relevant.

## Deliverables at the end of every session

Update `Site_Build_Log.md` with a new version stamp — only for sessions where
`build_site.js` (or other shipped code) actually changed; pure content-authoring sessions
(e.g. glossary CSV work in the claude.ai project) don't get a stamp until that content is
actually built into the site. Overwrite `PASTEBLOCK.md` with a fresh handoff for next
session: what shipped, what's still open, anything Greg needs to do outside this repo.
