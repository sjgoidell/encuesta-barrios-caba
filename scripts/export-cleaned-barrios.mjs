/**
 * export-cleaned-barrios.mjs  —  build the whitelist of valid barrio slugs.
 *
 * Reads public/data/responses.geojson, normalizes each `barrio` value, drops
 * obviously-invalid and out-of-area names, and writes the de-duplicated list
 * (sorted by frequency desc) to public/data/cleanedBarrios.json. The map uses
 * this list to decide which response barrios to render.
 *
 * Run: npm run export-barrios
 */

import fs from 'fs';
import path from 'path';

// Normalized slugs to exclude. These are Greater Buenos Aires (AMBA) localities,
// not CABA barrios, so they should not appear on the CABA map. Add future
// out-of-area or junk slugs here.
const EXCLUDED_SLUGS = new Set(['test', 'asdf', 'olivos', 'martinez', 'villacaraza', 'valentinalsina']);

const normalizeBarrio = (str) =>
  str
    .toLowerCase()
    .normalize('NFD')                      // separate accents
    .replace(/[\u0300-\u036f]/g, '')       // remove accents
    .replace(/\s+/g, '')                   // remove spaces
    .replace(/[^a-z0-9]/g, '')             // remove punctuation/specials
    .trim();

const main = async () => {
  const raw = fs.readFileSync('./public/data/responses.geojson', 'utf-8');
  const data = JSON.parse(raw);

  const barrioCounts = {};

  data.features.forEach((feature) => {
    const rawBarrio = feature.properties.barrio || '';
    const barrio = normalizeBarrio(rawBarrio);

    // Skip obviously invalid names and out-of-area (AMBA) localities
    if (barrio.length <= 4) return;
    if (EXCLUDED_SLUGS.has(barrio)) return;

    barrioCounts[barrio] = (barrioCounts[barrio] || 0) + 1;
  });

  const sorted = Object.entries(barrioCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([barrio]) => barrio);

  const outputPath = path.resolve('./public/data/cleanedBarrios.json');
  fs.writeFileSync(outputPath, JSON.stringify(sorted, null, 2));
  console.log(`✅ Exported ${sorted.length} cleaned barrios to cleanedBarrios.json`);
};

main();
