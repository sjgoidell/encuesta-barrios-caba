// to run: npm run merge-manzanas

import fs from 'fs';
import path from 'path';
import buffer from '@turf/buffer';
import dissolve from '@turf/dissolve';
import { featureCollection } from '@turf/helpers';

// Load input GeoJSON
const input = JSON.parse(fs.readFileSync('./public/data/manzanas.geojson', 'utf-8'));

// Tag each feature with a merge group
input.features.forEach(f => {
  f.properties.manzana_id = f.properties.id;
});

// 1. Flatten all geometries to Polygons
const flattened = [];
input.features.forEach(f => {
  if (f.geometry.type === 'Polygon') {
    flattened.push(f);
  } else if (f.geometry.type === 'MultiPolygon') {
    f.geometry.coordinates.forEach(coords => {
      flattened.push({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: coords,
        },
        properties: { ...f.properties },
      });
    });
  }
});

// 2. Buffer each feature outward slightly (e.g. 2m)
const buffered = flattened.map(f => {
  try {
    return buffer(f, 0.005, { units: 'kilometers' });
  } catch (e) {
    console.warn(`⚠️ Buffer failed for feature ${f.properties.id}:`, e.message);
    return null;
  }
}).filter(Boolean);

// 3. Group buffered by manzana_id
const grouped = new Map();
buffered.forEach(f => {
  const id = f.properties.manzana_id;
  if (!grouped.has(id)) grouped.set(id, []);
  grouped.get(id).push(f);
});

// 4. Dissolve each group
const merged = [];
let countDissolved = 0;
let countFallback = 0;

for (const [id, features] of grouped.entries()) {
  try {
    const result = dissolve(featureCollection(features), { propertyName: 'manzana_id' });
    const feature = result.features[0]; // dissolve returns FeatureCollection
    feature.properties = { id: Number(id) };
    merged.push(feature);
    countDissolved++;
  } catch (e) {
    console.warn(`❌ Dissolve failed for manzana ${id}:`, e.message);

    // Fallback to MultiPolygon
    const multipolygon = {
      type: 'Feature',
      properties: { id: Number(id) },
      geometry: {
        type: 'MultiPolygon',
        coordinates: features.map(f =>
          f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
        ),
      },
    };
    merged.push(multipolygon);
    countFallback++;
  }
}

// Write output
const output = featureCollection(merged);
fs.writeFileSync('./public/data/merged-manzanas.geojson', JSON.stringify(output, null, 2));

console.log(`\n✅ Wrote ${merged.length} merged manzanas to merged-manzanas.geojson`);

console.log('\n📊 Merge Summary:');
console.log(`✅ Dissolved:         ${countDissolved}`);
console.log(`🆘 Fallback (raw MP): ${countFallback}`);
