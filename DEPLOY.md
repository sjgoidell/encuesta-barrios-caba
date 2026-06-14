# Deploy runbook — dondevivocaba.com

> 🚦 **NEVER push to production without permission.** Before any `git push` (or
> anything that reaches prod), STOP, show a working **demo** of the change
> running locally, and **explicitly ask for permission to push**. Wait for a
> clear "yes." No exceptions, even for small changes.
>
> 🔒 **Privacy gate:** the public `public/data/responses.geojson` must only ever
> contain `id`, `barrio`, `pinLocation` (+ `barrio_cleaned` added by
> preprocessing). The export script (`scripts/export-responses-geojson.cjs`)
> enforces this — do not add personal fields. `responses.csv` is private and
> gitignored; never commit or publish it.

## Prerequisites
- Node 22+, `npm install` at repo root.
- For the Firebase export scripts: a Firebase service-account key. The scripts
  currently `require` it from a path **outside** this project
  (`.../encuesta-barrios-caba-personal/firebase-service-account.json`); update
  that path for your machine. The key must never be committed (it is gitignored).

## Standard map update (responses changed)
```bash
cd /path/to/encuesta-barrios-caba
npm run export-geojson     # Firestore -> public/data/responses.geojson (privacy-safe schema)
npm run export-barrios     # responses.geojson -> public/data/cleanedBarrios.json
npm run preprocess-map     # -> enriched-manzanas / pin-points / barrio-labels (+ barrio_cleaned)
npm run dev                # VERIFY locally before pushing  (http://localhost:5173/map_test)
git add .
git commit -m "vX.X.X updated map <Month Year>"
git push                   # ONLY after demo shown + permission granted
```

## When receiving new barrios / block geometry (manzanas.geojson changed)
```bash
npm run merge-manzanas     # public/data/manzanas.geojson -> merged-manzanas.geojson
npm run export-geojson     # refresh responses (if needed)
npm run export-barrios
npm run preprocess-map
npm run dev                # VERIFY
git add .
git commit -m "vX.X.X updated map <Month Year>"
git push                   # ONLY after demo shown + permission granted
```

## Update the private analysis CSV (not published)
```bash
npm run export-csv         # Firestore -> responses.csv  (PRIVATE, gitignored)
```

## Script reference (relocated to /scripts in Phase 2)
| npm script | file | purpose |
|---|---|---|
| `export-geojson` | `scripts/export-responses-geojson.cjs` | Firestore → public responses.geojson (privacy-safe) |
| `export-csv` | `scripts/export-responses-csv.cjs` | Firestore → private responses.csv |
| `export-barrios` | `scripts/export-cleaned-barrios.mjs` | responses → cleanedBarrios.json whitelist |
| `merge-manzanas` | `scripts/merge-manzanas.mjs` | manzanas.geojson → merged-manzanas.geojson |
| `preprocess-map` | `scripts/preprocess-map.mjs` | merged + responses → enriched/pin/label layers |
| — | `scripts/strip-responses-privacy.cjs` | one-time PII strip (P3-PRIVACY) |

## Recover from wrong git remote
```bash
git remote set-url origin https://github.com/sjgoidell/encuesta-barrios-caba
```

## Notes / open items
- **Deploy mechanism (P0-STAGING):** how `git push` reaches production is not yet
  documented here — there is no CI workflow and no `hosting` block in
  `firebase.json`. Confirm whether prod auto-deploys from `main` (Firebase Hosting
  GitHub integration / other host) or requires a manual `firebase deploy`, and
  document it here.
- The "new barrios" order above follows the original runbook; logically
  `export-geojson` should precede `export-barrios`/`preprocess-map` since the
  latter read `responses.geojson`.
