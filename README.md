# Dónde Vivo CABA — dondevivocaba.com

A crowd-sourced map of how residents of the City of Buenos Aires (CABA) define
their own neighborhoods ("barrios"). Respondents pin where they live, draw their
barrio's boundary, and name it; the responses are aggregated into a block
("manzana") level map showing which barrio each city block belongs to. Inspired
by the NYT "Extremely Detailed Map of NYC Neighborhoods."

- **Landing (hub):** https://dondevivocaba.com — two buttons: "Sumar mi barrio" (survey) and "Revisar los resultados" (map)
- **Survey:** https://dondevivocaba.com/encuesta
- **Map:** https://dondevivocaba.com/live_results (`/map_test` redirects here)

## Stack
React 19 + Vite 6 · Mapbox GL JS v3 · Turf.js · Firebase (Firestore + one Cloud
Function) · **Netlify** hosting (CD from `main`) · GA4. Full detail and roadmap
in `docs/ARCHITECTURE.md`.

## Project layout
```
scripts/        data pipeline (run via npm — see "Updating the map")
src/
  app/          Landing.jsx (hub) + the survey (App.jsx + MapScreen, BoundaryDrawScreen)
  map/          the public choropleth map (MapView.jsx)
  components/   shared (QueriedDB)
  data/         static option lists
  lib/          firebase.js, analytics.js
  main.jsx      routes: / (hub), /encuesta (survey), /live_results (map, /map_test redirects here), /db (counts)
data/           barrio-names.json (cleaned key → display name)
public/data/    SERVED data: enriched-manzanas.geojson, responses.geojson, cleanedBarrios.json
pipeline-data/  pipeline source/intermediate (NOT web-published): manzanas + merged-manzanas
functions/      Firebase Cloud Function (deploys separately via firebase)
docs/           ARCHITECTURE.md (architecture + roadmap), FORMULA.md (methodology)
```

## Run locally
```bash
npm install
npm run dev        # http://localhost:5173  (hub at /, survey at /encuesta, map at /live_results)
npm run build      # production build to dist/
npm run lint
```
Requires `.env.local` with `VITE_MAPBOX_TOKEN`.

## Data pipeline (overview)
```
survey → Firestore 'responses'
  → npm run export-geojson  → public/data/responses.geojson (privacy-safe: id, barrio, pinLocation)
  → npm run export-barrios  → cleanedBarrios.json (valid barrio whitelist)
  → npm run merge-manzanas  → pipeline-data/merged-manzanas.geojson (only when raw blocks change)
  → npm run preprocess-map  → public/data/enriched-manzanas.geojson (the served choropleth)
map (/live_results) renders the precomputed enriched-manzanas (no in-browser recompute).
```
The %-per-manzana methodology (inverse-distance weighting) is documented in
[`docs/FORMULA.md`](docs/FORMULA.md).

## Updating the map with new responses
```bash
git checkout -b update-map-<month>
npm run refresh-data     # = export-geojson → export-barrios → preprocess-map  (preprocess is ~5 min)
npm run dev              # verify at /live_results
git add . && git commit -m "vX.X.X updated map <Month Year>"
git push -u origin update-map-<month>     # open a PR → main
# review the Netlify Deploy Preview, then merge the PR to ship.
```
- Needs the Firebase service-account key (path set in the export scripts; kept outside the repo).
- New raw block geometry: place it at `pipeline-data/manzanas.geojson`, run `npm run merge-manzanas`, then `npm run refresh-data`.

## Deploying
**Netlify** continuously deploys `main` (build `npm run build` → publish `dist/`).
Work on a branch → open a PR → review the **Netlify Deploy Preview** → merge to
ship. Rollback via Netlify **Deploys → "Publish deploy."** Never push directly to
`main`. See [`DEPLOY.md`](DEPLOY.md).

## Roadmap
The map now lives at `/live_results` (promoted from `/map_test`, which
redirects there for old links), with a first-load intro modal and an "acerca
de" sidebar blurb. Remaining plan: a legend and fuller methodology/about
content. See `docs/ARCHITECTURE.md` for the full roadmap (architecture,
performance, UI/UX proposals, and publication plan).

## Privacy
The public `responses.geojson` is restricted to `id`, `barrio`, and `pinLocation`
— no personal data is published. `responses.csv` is private and gitignored.
