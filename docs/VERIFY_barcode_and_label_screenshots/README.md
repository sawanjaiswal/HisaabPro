# QA Screenshots — Barcode + Label

Screenshots captured via Playwright or marked SKIPPED when app server unavailable.

## Status
- POS scan button: SKIPPED (requires running app + Android device)
- Scanner modal idle/scanning/success/error: SKIPPED (requires native device)
- Label dialog standard/compact/barcode-only at 375px: SKIPPED (requires running app)
- Label dialog at 320px: SKIPPED (requires running app)
- Sheet preview THERMAL/A4/A5: SKIPPED (requires running app)
- PDF download preview: SKIPPED (requires running app)
- Print preview: SKIPPED (requires running app)
- ProductsPage bulk select Print labels: SKIPPED (requires running app)

## Build verification
- tsc --noEmit: CLEAN
- enforce.js: CLEAN (all 8 checks passed)
- npm run build: CLEAN
- @zxing/browser chunk: barcode-BcfpL7Aw.js (separate from main — VERIFIED)
- Android cap sync: CLEAN (@capacitor-mlkit/barcode-scanning@8.1.0 detected)

