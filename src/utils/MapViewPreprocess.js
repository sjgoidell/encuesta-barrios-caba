
// to run: npm run preprocess-map

import fs from 'fs';
import path from 'path';
import * as turf from '@turf/turf';
import groupBy from 'lodash.groupby';

const palette = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728',
  '#9467bd', '#8c564b', '#e377c2', '#7f7f7f',
  '#bcbd22', '#17becf', '#aec7e8', '#ffbb78',
  '#98df8a', '#ff9896', '#c5b0d5', '#c49c94',
];

const hexToRgb = (hex) => {
  const [, r, g, b] = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i) || [];
  return r && g && b ? [parseInt(r, 16), parseInt(g, 16), parseInt(b, 16)] : [0, 0, 0];
};

const rgbToHex = (r, g, b) =>
  '#' + [r, g, b].map(x => (x < 16 ? '0' : '') + x.toString(16)).join('');

const normalizeBarrio = (str) =>
  str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .trim();

const enrichManzana = (feature, responses, barrioColors, palette, cleanedBarrios, pinPoints) => {
  const centroid = turf.centroid(feature);
  const barrios = {};
  let count = 0;

  responses.forEach(response => {
    if (!turf.booleanIntersects(feature, response)) return;

    const raw = response.properties.barrio ?? '';
    const barrio = normalizeBarrio(raw);
    if (barrio.length < 5 || !cleanedBarrios.has(barrio)) return;

    try {
      const pin = JSON.parse(response.properties.pinLocation || '{}');
      if (!pin.lat || !pin.lng) return;

      const pinPoint = turf.point([pin.lng, pin.lat]);
      pinPoints.push(pinPoint);

      const distance = turf.distance(pinPoint, centroid, { units: 'kilometers' });
      if (distance > 5) return;

      const weight = 1 / (distance + 0.01);
      barrios[barrio] = (barrios[barrio] || 0) + weight;

      if (!barrioColors[barrio]) {
        barrioColors[barrio] = palette[Object.keys(barrioColors).length % palette.length];
      }

      count += weight;
    } catch (e) {
      console.warn('Invalid pinLocation:', response.properties.pinLocation);
    }
  });

  let blendedColor = '#444444';
  if (count > 0) {
    let r = 0, g = 0, b = 0;
    for (const [slug, weight] of Object.entries(barrios)) {
      const percent = weight / count;
      const [cr, cg, cb] = hexToRgb(barrioColors[slug] || '#888888');
      r += cr * percent;
      g += cg * percent;
      b += cb * percent;
    }
    blendedColor = rgbToHex(Math.round(r), Math.round(g), Math.round(b));
  }

  let majorityBarrio = 'desconocido';
  let maxWeight = 0;
  for (const [slug, weight] of Object.entries(barrios)) {
    if (weight > maxWeight) {
      majorityBarrio = slug;
      maxWeight = weight;
    }
  }

  return {
    type: 'Feature',
    geometry: feature.geometry,
    properties: {
      id: feature.properties?.id || null,
      totalResponses: count,
      barrios,
      blendedColor,
      majorityBarrio,
    },
  };
};

const main = async () => {
  const rawManzanas = fs.readFileSync('./public/data/merged-manzanas.geojson', 'utf-8');
  const rawResponses = fs.readFileSync('./public/data/responses.geojson', 'utf-8');
  const rawCleaned = fs.readFileSync('./public/data/cleanedBarrios.json', 'utf-8');

  const manzanas = JSON.parse(rawManzanas);
  const responses = JSON.parse(rawResponses);
  const cleanedBarrios = new Set(JSON.parse(rawCleaned));

  const barrioColors = {};
  const pinPoints = [];

  // ✅ Normalize barrios in responses
  responses.features.forEach((feature) => {
    const raw = feature.properties.barrio ?? '';
    feature.properties.barrio_cleaned = normalizeBarrio(raw);
  });

  const responseFeatures = responses.features.map(f =>
    turf.feature(f.geometry, f.properties)
  );

  const enriched = manzanas.features.map(feature =>
    enrichManzana(feature, responseFeatures, barrioColors, palette, cleanedBarrios, pinPoints)
  );

  const enrichedManzanas = {
    type: 'FeatureCollection',
    features: enriched.filter(f => f.properties.totalResponses > 0),
  };

  // create label centroids
  const labelPoints = [];
  const grouped = groupBy(enrichedManzanas.features, f => f.properties.majorityBarrio);
  Object.entries(grouped).forEach(([slug, features]) => {
    if (!slug || slug === 'desconocido') return;
    try {
      const collection = turf.featureCollection(features);
      const combined = turf.combine(collection);
      const centroid = turf.centroid(combined);
      centroid.properties = { barrio: slug };
      labelPoints.push(centroid);
    } catch (e) {
      console.warn(`Failed centroid for ${slug}`);
    }
  });

  // Save output
  fs.writeFileSync('./public/data/enriched-manzanas.geojson', JSON.stringify(enrichedManzanas, null, 2));
  fs.writeFileSync('./public/data/pin-points.geojson', JSON.stringify({
    type: 'FeatureCollection',
    features: pinPoints
  }, null, 2));
  fs.writeFileSync('./public/data/barrio-labels.geojson', JSON.stringify({
    type: 'FeatureCollection',
    features: labelPoints
  }, null, 2));

  // ✅ Overwrite responses.geojson with barrio_cleaned field added
  fs.writeFileSync('./public/data/responses.geojson', JSON.stringify(responses, null, 2));

  console.log('✅ Preprocessing complete. Files saved:');
  console.log(' - enriched-manzanas.geojson');
  console.log(' - pin-points.geojson');
  console.log(' - barrio-labels.geojson');
  console.log(' - responses.geojson (with barrio_cleaned)');
};

main();
