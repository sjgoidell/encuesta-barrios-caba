/**
 * geo-precision.mjs  —  reduce GeoJSON coordinate precision (P4D-FILESIZE).
 *
 * Source GeoJSON ships ~15 decimal places per coordinate (sub-nanometer — e.g.
 * -58.530318168054194), which bloats file size, transfer, and parse time for no
 * visible benefit. 6 decimals ≈ 11 cm, far finer than anything the city-block map
 * renders. This rounds every coordinate to DECIMALS places.
 *
 * Two uses:
 *   1. Library — import { roundFeatureCollection } and round in the pipeline so
 *      regenerated files stay compact (merge-manzanas, preprocess-map).
 *   2. CLI — `node scripts/geo-precision.mjs <file.geojson> [more.geojson ...]`
 *      rounds each file IN PLACE (one-time fix for already-generated files).
 */

import fs from 'fs';
import { pathToFileURL } from 'node:url';

export const DECIMALS = 6;
const FACTOR = 10 ** DECIMALS;

const roundNum = (n) => Math.round(n * FACTOR) / FACTOR;

// Recursively round a coordinate value (number) or nested coordinate arrays.
const roundCoords = (c) => (Array.isArray(c) ? c.map(roundCoords) : roundNum(c));

export const roundFeatureCollection = (geojson) => {
  (geojson.features || []).forEach((f) => {
    if (f.geometry && f.geometry.coordinates) {
      f.geometry.coordinates = roundCoords(f.geometry.coordinates);
    }
  });
  return geojson;
};

// CLI: round each given file in place and report the size change.
const main = () => {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Usage: node scripts/geo-precision.mjs <file.geojson> [...]');
    process.exit(1);
  }
  for (const path of files) {
    const before = fs.statSync(path).size;
    const geojson = JSON.parse(fs.readFileSync(path, 'utf8'));
    roundFeatureCollection(geojson);
    fs.writeFileSync(path, JSON.stringify(geojson));
    const after = fs.statSync(path).size;
    const pct = (((before - after) / before) * 100).toFixed(1);
    console.log(`✅ ${path}: ${(before / 1e6).toFixed(1)}MB -> ${(after / 1e6).toFixed(1)}MB (-${pct}%) @ ${DECIMALS} decimals`);
  }
};

// Run as CLI only when invoked directly (not when imported by the pipeline).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
