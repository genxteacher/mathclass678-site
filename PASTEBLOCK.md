# PASTEBLOCK — session handoff (2026-11-07)

## Shipped this session (v1.26.0, branch `site-refresh-nov7`, NOT pushed)
- Live-store refresh from the Nov 7 crawl of all 500 live TPT math listings: `node tools/live_refresh.js <live_all.json>` writes data/live_tpt.json, live_ids.json (500), retired_ids.json (+821 not-live ids the repo still names) and patches the data JSON. Re-run it after any TPT listing change, then rebuild.
- Every TPT link is put on its current URL at write time; new TPT-URL GATE fails the build otherwise.
- ILEARN Checkpoint 2 band on the home page (under the hero) and /tiktok: free band sets, free screener per grade, then practice / reteach / bundle with live prices and pages. Retire with `ILEARN_CP2.show = false` in build_site.js (auto-off after Feb 5 2027).

## Greg's actions
1. Review and push `site-refresh-nov7` (merge to main); then `node tools/indexnow.js` and commit data/indexnow-state.json.

## Open
- The state-testing exporter (tools/site_export/mc678_curricula.py) also writes live_ids.json; if it runs again, re-run tools/live_refresh.js after it.
- Not on this site by design: Middle School Math ULTIMATE Bundle 16515388; the state lines (on statetestmath.com). Not on the site and no home for it yet: October Sky Movie Guide 18074898.
- Algebra 1 pages say "student packet (7 pages)" (the packet itself); TPT's page count for a lesson is 21 (packet + homework + keys + deck pages). Not changed.
- Pinterest items from the Oct 12 handoff (retired-freebie pins, "Word Wall" board names) still open.
