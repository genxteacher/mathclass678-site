# PASTEBLOCK — session handoff (2026-10-12)

## Shipped this session (v1.23.0)
- Retired product lines removed from the site (Greg deactivated 158 TPT listings Oct 12): sub plans (paid), activity packs, Mistake of the Week, Money Labs, Mystery Pictures, anchor charts/posters, every word wall, the free Math About Me and the free TN personal finance sample. 20 pages gone, 301s in `_redirects` (`RETIRED_LINE_REDIRECTS`). See Site_Build_Log v1.23.0.
- Glossary kept (URLs /word-wall/ unchanged) but relabelled "Glossary" and no longer sells word walls.
- New `retired_ids.json` + RETIRED-ID GATE in build_site.js.

## Greg's actions
1. Pinterest: two scheduled pins point at removed pages (they 301 to /free.html, but the pin text promotes a retired freebie): "Free Middle School Math Word Wall: 80 Vocabulary Cards" (2026-09 batch, Oct 14) and "Free Combining Like Terms Poster: Anchor Chart" (2026-10 batch, Oct 24). Also two already-published pins (2026-09 batch, Oct 2 and Oct 5): "Free Math About Me Activity" 6th and 7th grade (now 301 to /free.html). Delete or edit them. The vocabulary pins sit on boards named "… Math Word Wall | Vocabulary Cards"; they still land on live glossary pages, rename the boards if wanted.

## Open
- tools/pinterest/pins.mjs still names vocabulary boards "Word Wall"; change before building the next batch.
- mc678_site_links.json still carries word_wall / interactive_notebooks / posters_anchor_charts rows (not read by the build).
