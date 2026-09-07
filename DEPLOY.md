# Deploy runbook — dondevivocaba.com

> 🚦 **NEVER deploy to production without permission.** The flow is: work on a
> branch → open a PR → review the **Netlify Deploy Preview** → get explicit
> approval → merge. Merging `main` is what ships to prod. No direct pushes to
> `main`. No exceptions.
>
> 🔒 **Privacy gate:** the public `public/data/responses.geojson` must only ever
> contain `id`, `barrio`, `pinLocation` (+ `barrio_cleaned` added by
> preprocessing). The export script (`scripts/export-responses-geojson.cjs`)
> enforces this — do not add personal fields. `responses.csv` is private and
> gitignored; never commit or publish it.

## How hosting / deploy works
- **Netlify** continuous-deploys from GitHub: production branch **`main`**, build
  `npm run build`, publish `dist/`. Pushing/merging to `main` auto-deploys to
  dondevivocaba.com. PRs against `main` get a **Netlify Deploy Preview** URL.
- **Rollback:** Netlify **Deploys → "Publish deploy"** on a previous good deploy
  (instant; no git needed).
- The **Firebase Cloud Function** (`functions/`) deploys separately via
  `firebase deploy --only functions` — unrelated to the Netlify site deploy.

## Prerequisites
- Node 22+, `npm install` at repo root.
- For the Firebase export scripts: a Firebase service-account key. The scripts
  `require` it from a path **outside** this project; update that path for your
  machine. The key must never be committed (it is gitignored).

## Standard map update (new survey responses)
```bash
cd /path/to/encuesta-barrios-caba
git checkout -b update-map-<month>      # work on a branch, not main
npm run refresh-data                     # export-geojson → export-barrios → preprocess-map
npm run dev                              # VERIFY locally (http://localhost:5173/live_results)
git add . && git commit -m "vX.X.X updated map <Month Year>"
git push -u origin update-map-<month>    # then open a PR → main
# Review the Netlify Deploy Preview, get approval, then MERGE the PR to ship.
```
`refresh-data` chains the three steps in the right order so there's no
"remember to run X before Y" risk.

## When the raw block geometry changes (`manzanas.geojson`)
```bash
# Place the new raw blocks at pipeline-data/manzanas.geojson (gitignored, ~113MB)
npm run merge-manzanas    # pipeline-data/manzanas.geojson → pipeline-data/merged-manzanas.geojson
npm run refresh-data      # then regenerate responses/barrios/enriched
# verify, branch, PR, preview, merge (as above)
```

## Update the private analysis CSV (not published)
```bash
npm run export-csv         # Firestore → responses.csv  (PRIVATE, gitignored)
```

## Script reference
| npm script | file | purpose |
|---|---|---|
| `refresh-data` | — | runs export-geojson → export-barrios → preprocess-map |
| `export-geojson` | `scripts/export-responses-geojson.cjs` | Firestore → public/data/responses.geojson (privacy-safe; drops orphans outside CABA) |
| `export-csv` | `scripts/export-responses-csv.cjs` | Firestore → private responses.csv |
| `export-barrios` | `scripts/export-cleaned-barrios.mjs` | responses → cleanedBarrios.json (AMBA excluded) |
| `merge-manzanas` | `scripts/merge-manzanas.mjs` | pipeline-data/manzanas.geojson → pipeline-data/merged-manzanas.geojson |
| `preprocess-map` | `scripts/preprocess-map.mjs` | merged + responses → enriched-manzanas (the served choropleth) |
| — | `scripts/geo-precision.mjs` | coordinate-precision util (imported by the pipeline; CLI for one-off rounding) |
| — | `scripts/strip-responses-privacy.cjs` | one-time PII strip (P3-PRIVACY) |

## Data layout
- **`public/data/`** = web-published, served files only: `enriched-manzanas.geojson`
  (the map), `responses.geojson` (límites view), `cleanedBarrios.json`.
- **`pipeline-data/`** = pipeline source/intermediate, NOT web-published:
  `manzanas.geojson` (raw, gitignored), `merged-manzanas.geojson` (intermediate).

## Recover from wrong git remote
```bash
git remote set-url origin https://github.com/sjgoidell/encuesta-barrios-caba
```
