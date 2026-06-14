# Dónde Vivo CABA — dondevivocaba.com

A crowd-sourced map of how residents of the City of Buenos Aires (CABA) define
their own neighborhoods ("barrios"). Respondents pin where they live, draw their
barrio's boundary, and name it; the responses are aggregated into a block
("manzana") level map showing which barrio each city block belongs to. Inspired
by the NYT "Extremely Detailed Map of NYC Neighborhoods."

- **Survey:** https://dondevivocaba.com
- **Map:** https://dondevivocaba.com/map_test

## Stack
React 19 + Vite 6 · Mapbox GL JS v3 · Turf.js · Firebase (Firestore + Functions +
Hosting) · Google Analytics 4. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
for the full breakdown.

## Project layout
```
scripts/        data-processing & export scripts (run via npm)
src/
  app/          the survey (App.jsx + MapScreen, BoundaryDrawScreen, App.css)
  map/          the public choropleth map (MapView.jsx)
  components/    shared components (QueriedDB)
  data/         static option lists (barrios, comunidades, provincias, paises)
  lib/          firebase.js, analytics.js
  main.jsx      routes: / (survey), /map_test (map), /db (barrio counts)
data/           barrio-names.json (cleaned key -> display name)
public/data/    geojson/json data artifacts served to the app
functions/      Firebase Cloud Function (Sheets sync)
docs/           ARCHITECTURE, FORMULA, DEPENDENCIES, PROPOSAL
```

## Run locally
```bash
npm install
npm run dev        # http://localhost:5173  (survey at /, map at /map_test)
npm run build      # production build to dist/
npm run lint
```
Requires a `.env.local` with `VITE_MAPBOX_TOKEN` (Mapbox access token).

## Data pipeline (overview)
```
survey (App.jsx) -> Firestore 'responses'
  -> export-geojson  -> public/data/responses.geojson (privacy-safe: id, barrio, pinLocation)
  -> export-barrios  -> cleanedBarrios.json (valid barrio whitelist)
  -> merge-manzanas  -> merged-manzanas.geojson (from manzanas.geojson source blocks)
  -> preprocess-map  -> enriched-manzanas / pin-points / barrio-labels
map (MapView.jsx) fetches merged-manzanas + responses + cleanedBarrios and renders
```
Full pipeline and the %-per-manzana formula: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
[`docs/FORMULA.md`](docs/FORMULA.md).

## Deploying
See [`DEPLOY.md`](DEPLOY.md). **Never push to production without showing a local
demo and getting explicit permission first.**

## Privacy
The public `responses.geojson` is restricted to `id`, `barrio`, and `pinLocation`;
no personal data (email, demographics, etc.) is ever published. `responses.csv`
is private and gitignored. See `docs/PROPOSAL.md` for the privacy work and open
items (Firestore rules, git history).
