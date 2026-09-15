# PASTEBLOCK — session handoff (2026-09-15)

## Shipped this session (v1.9.0)
- Pinterest pin generator: `node tools/pinterest/pins.mjs --batch YYYY-MM` (see Site_Build_Log v1.9.0).
- Batches built and committed: `pinterest/2026-09.csv` (87 pins, Sept 16–Oct 14) and `pinterest/2026-10.csv` (87 pins, Oct 16–Nov 13); images in `assets/pins/`.
- build_site.js copies `assets/pins/**` into dist.

## Greg's actions
1. Push this repo (GitHub Desktop) so the pin images are live on www.mathclass678.com.
2. Create any missing boards (names must match the CSV exactly; list in the Pinterest plan).
3. Pinterest caps an account at 100 scheduled pins, so the batch CSVs are NOT uploaded directly. The first 15 rows of 2026-09 are scheduled; everything else (both sites) is dealt into weekly files by `tools/site_export/pin_uploads.py` in the state testing repo: upload `~/Documents/Pinterest Uploads/<Sunday>.csv` each Sunday.

## Open
- 6 worked examples on 3 standards pages show "[object Object]" (7.NS.A.1d, 7.NS.A.2c, 7.NS.A.2d) — fix the strings in STANDARDS_CONTENT.
- Next batches: add a plan to PLANS in tools/pinterest/pins.mjs (winter: 6th/7th expressions & equations, 8th functions/systems).
