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

**Rev. S14** — DEDICATED PER-FREEBIE KIT FORMS now LIVE doctrine (built + shipped S13; no
longer "shared form only"). FREEBIE_KIT_FORMS map in build_site.js is fully populated
— all 18 freebies route through their own dedicated Kit form with its own personalized
confirmation-email copy, rather than one shared form with generic copy. The redirect
mechanism itself did not change: the S12 submit-gated success-detection script remains
the sole authority for sending visitors to the correct TPT listing, regardless of which
Kit form is embedded — native per-form Kit redirects were deliberately not used, and
every dedicated form stays on "Show a success message" to match the original shared-form
behavior. Added a new locked guardrail reflecting this: never switch any per-freebie form
to Kit's native "Redirect to an external page." Claude Code confirmed set up on Greg's
machine as of S13 — direct push is now available going forward, alongside the GitHub
Desktop fallback; both paths remain valid, Greg's choice per session.

## Who / what

Greg — 25+ yr middle-school math teacher, sole operator of Math Class 678 (TPT storefront
math-class-678). Building mathclass678.com as a branded catalog hub for the 103
4-in-1 Skill Sheets™ (Reference · Practice · Apply · Assess), grades 6–8 CCSS, plus a
free math vocabulary glossary (Word Wall branch, grades 6–8 + Algebra 1) and a Kit-gated
freebie funnel for growing the email list from external traffic.

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
`MOTW_content_master.csv` — only if a MOTW section is added (still deferred).

Product names on site = exact `SkillName` from CSV (`nameClean` strips FREE
parentheticals for display; `slugify` normalizes for filenames). CCSS shown as clean
leaf codes only (strip facet tags: split on first hyphen, take left side).

Catalog counts (confirmed S9): 6th 34 · 7th 32 · 8th 37 · Total 103
Freebies (skill sheets): #19 Combining Like Terms (6th) · #48 Combining Like Terms (7th)
Free resources (non-skill-sheet): 16 items in `FREE_RESOURCES` array — all route to `/free.html`
Bundles: 30 total (all live, all URLs confirmed) — strand · topic · MEGA · ULTIMATE tiers
Strands present: EE · NS · RP · SP · G · F

Two parallel entry points for the 18 total freebies (16 free resources + 2 freebie skill
sheets) as of S12: the existing `/free.html` hub (direct-to-TPT, no gate, unchanged
since before S12) and 18 individual Kit-gated pages at `/free/{slug}.html`, each on its
own dedicated Kit form as of S13 (see Freebie / Kit-gated funnel architecture below).
These serve different traffic and are never cross-linked — see the locked decision there.

## Glossary / Word Wall content authority

Four CSVs are the content ground truth for the Word Wall / glossary branch:
`WordWall_Content_6th_MASTER.csv` · `WordWall_Content_7th_MASTER.csv` ·
`WordWall_Content_8th_MASTER.csv` · `WordWall_Content_Algebra_MASTER.csv`.

Status: content-complete and LIVE in code as of S12. The branch is built into
`build_site.js` and shipped — this is deployed doctrine, not a pending decision.

Counts: 6th grade 106 terms · 7th grade 110 terms · 8th grade 113 terms ·
Algebra 1 98 terms · 427 terms total, each a unique, deduplicated, canonical
glossary entry.

Column schema (identical across all four files): `slug`, `term`, `grade`,
`primary_ccss` (6th–8th only, blank for Algebra), `all_ccss` (6th–8th only, `;`-separated,
blank for Algebra), `strand` (primary strand for 6th–8th, or the Algebra *unit* name —
this is the Algebra join key, not a CCSS strand), `all_strands` (`;`-separated),
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
four-format design remains the product a teacher buys on TPT.

## Site structure (v1.5.1 — built S13)

18 total pages that matter for your day-to-day work here, plus generated pages:
`index.html`, `catalog.html`, `bundles.html`, `word-wall.html`, `free.html`,
`about.html`, `contact.html`, `get-started.html`, `grade-6/7/8.html`, `404.html`.

Generated from `build_site.js`: `/sheets/{slug}.html` (103) · `/bundles/{slug}.html` (30)
· `/standards/{slug}.html` (93) · `/word-wall/{slug}.html` (427) · `/free/{slug}.html` (18,
external-traffic-only, not linked from nav or `/free.html`).

Slug collision handling: two "Combining Like Terms" sheets (#19, #48), their matching
glossary terms, and their matching freebie pages all get grade suffixes:
`combining-like-terms-grade-6` / `combining-like-terms-grade-7`.

## Word Wall / glossary branch — architecture (live, built S12)

Positioning: not a product catalog — a free math glossary that happens to sell
print-ready Word Wall cards. Individual term pages target long-tail search and are the
single largest evergreen SEO surface on the site.

Dual-key architecture: 6th–8th are CCSS-keyed (`glossaryByCcss`, many-to-many on
`all_ccss`); Algebra is unit-keyed (`glossaryByUnit` on `strand`, 9 units).

Four rendering spots — three built, one deferred: glossary term page itself (built,
"Where this shows up" + related terms + cross-grade links), standards page retrofit
(built, "Key vocabulary" chips), sheet page retrofit (built, smaller chip row), bundle
page retrofit ("Key terms in this bundle" — **deferred twice now for
injection-risk/lower-value reasons; pick up only if Greg asks**).

Schema: `DefinedTerm`/`DefinedTermSet` JSON-LD. Never ship a term page whose "Where this
shows up" section is empty (Algebra's product-light unit-name variant is the intentional
exception — it always shows at least the unit name).

## Freebie / Kit-gated funnel architecture (live, built S12; dedicated forms added S13)

Purpose: grow the email list from cold external traffic (Pinterest, TikTok bio link,
anywhere Claude doesn't control the source) without touching the already-working
`/free.html` funnel.

**Locked decision — do not change without Greg explicitly asking:** the 18 individual
`/free/{slug}.html` pages are never linked from `/free.html`, primary nav, or anywhere
else on-site. `/free.html` stays direct-to-TPT, zero friction. Rationale: TPT review
velocity is the dominant ranking lever; warm on-site traffic converting with zero
friction matters more than harvesting emails from people who were already going to
download for free. Cold external traffic is the right audience for an email-gate trade.

**Mechanism:** each `/free/{slug}.html` page embeds a *dedicated* per-freebie Kit form —
`FREEBIE_KIT_FORMS` map in `build_site.js` is **fully populated as of S13**, all 18
freebies have their own form uid and their own confirmation-email copy naming that
specific download. A page-level script watches for a real submission and then sends the
visitor on to that freebie's correct TPT listing (file still delivered via TPT to
preserve download counts and review eligibility). This redirect logic is independent of
which Kit form is embedded — it does not rely on, and never has relied on, Kit's native
per-form redirect setting. Every dedicated form is deliberately left on "Show a success
message" (never "Redirect to an external page") so the site's own script remains the sole
redirect authority — do not let this drift if new freebie forms get created later.

**Locked technical constraint — do not regress:** the success-detection script must
require an actual `submit` event on the embedded form before it starts checking for a
success state. Presence-only DOM checks against Kit's markup will false-positive on
page load (this exact bug shipped and was fixed in S12 — see `Site_Build_Log.md` v1.5.0
for the full postmortem if you need it). Any future edit to this script must preserve
the submit-gate as the first check.

## Image asset model

All images live in this repo — no re-upload of image zips needed, ever, now that you're
working here directly.

- Product thumbnails (103): `assets/images/thumbs/thumb1_[grade]th_[slug].jpg` (or `.png`)
- Bundle thumbnails (30): `assets/images/bundles/`, named per `BUNDLES` array `thumb` field
- Freebie thumbnails (16): `assets/images/freebies/free_[key].jpg`
- Site asset images: `assets/images/` — see `Site_Build_Log.md` for the full filename
  manifest, including three S12 images that are `.png` rather than the site's usual
  `.jpg` (source files came from ChatGPT as PNG; code was written to match rather than
  asking Greg to convert — extension discipline matters, don't rename without re-encoding).

Glossary pages never use product art — brand tiles/quadrant mark only (IP policy above).

## Kit / email

- Shared form uid: `bd0030d799` — script `https://mathclass678.kit.com/bd0030d799/index.js`
- Embedded in: footer band (all pages) + Kit-hero block (homepage + all 103 sheet pages)
  + get-started page. **Not** in the freebie-gate slot of any of the 18 freebie pages as
  of S13 — those now use their own dedicated forms via `FREEBIE_KIT_FORMS`.
- `FREEBIE_KIT_FORMS` map: fully populated, all 18 entries. Treat this as populated data
  to preserve, not a template to reset.
- Every dedicated freebie form: "Show a success message" mode, confirmation email
  personalized to name that freebie, redirect-after-confirm pointed at
  `https://mathclass678.com/` (not Kit's default).
- Kit timezone: Eastern (should be Central — Greg's action in the Kit dashboard, not a
  code change).

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
- For any script involving a third-party embed's success/error state (Kit forms or
  otherwise): verify it gates on a real user action first — never trust a presence-only
  DOM check against a third party's markup.
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
- Kit timezone fix and TPT storefront copy corrections ("103 sheets / $505",
  TikTok handle) are Greg's actions, not code changes — just don't forget to ask if
  they're done when relevant.

## Deliverables at the end of every session

Update `Site_Build_Log.md` with a new version stamp — only for sessions where
`build_site.js` (or other shipped code) actually changed; pure content-authoring sessions
(e.g. glossary CSV work in the claude.ai project) don't get a stamp until that content is
actually built into the site. Overwrite `PASTEBLOCK.md` with a fresh handoff for next
session: what shipped, what's still open, anything Greg needs to do outside this repo.
