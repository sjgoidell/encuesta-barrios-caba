/**
 * preprocess-map.mjs  —  precompute the map layers offline.
 *
 * Reads merged-manzanas + responses + cleanedBarrios and, for every block, runs
 * the same inverse-distance-weighted enrichment the live map uses (see
 * enrichManzana below and docs/FORMULA.md) to produce:
 *   - enriched-manzanas.geojson  (blocks colored by barrio mix)
 *   - pin-points.geojson         (home points)
 *   - barrio-labels.geojson      (label centroids per majority barrio)
 * It also rewrites responses.geojson adding a `barrio_cleaned` slug.
 *
 * NOTE: MapView currently recomputes this in the browser instead of consuming
 * enriched-manzanas.geojson — see docs/ARCHITECTURE.md. The enrichManzana here
 * duplicates the MapView version; consolidate into a shared module (Phase 2/4C).
 *
 * Run: npm run preprocess-map
 */

import fs from 'fs';
import path from 'path';
import * as turf from '@turf/turf';
import groupBy from 'lodash.groupby';
import { roundFeatureCollection } from './geo-precision.mjs';

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
    // cleanedBarrios (export-cleaned-barrios.mjs) is the single source of
    // truth for valid/invalid barrios -- no separate length check here, so
    // the two scripts can't drift out of sync on the threshold again.
    if (!cleanedBarrios.has(barrio)) return;

    try {
      const pin = JSON.parse(response.properties.pinLocation || '{}');
      if (!pin.lat || !pin.lng) return;

      const pinPoint = turf.point([pin.lng, pin.lat]);
      pinPoints.push(pinPoint);

      const distance = turf.distance(pinPoint, centroid, { units: 'kilometers' });
      if (distance > 5) return;

      // Inverse-distance weight (P4E): closest residents weigh most, far-but-
      // including respondents still count, lower. The +0.3km ("neighborhood
      // scale") epsilon softens the decay vs the old +0.01: it keeps "locals
      // decide" but prevents a single adjacent respondent from single-handedly
      // defining a block. See docs/FORMULA.md.
      const weight = 1 / (distance + 0.3);
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
  const rawManzanas = fs.readFileSync('./pipeline-data/merged-manzanas.geojson', 'utf-8');
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

  // Save output — round coordinates to 6 decimals + minify (P4D-FILESIZE).
  // Only the files the app actually serves are written. pin-points.geojson and
  // barrio-labels.geojson are no longer generated (P4C): the map hides the pin
  // layer and builds barrio labels at runtime from enriched-manzanas.
  fs.writeFileSync('./public/data/enriched-manzanas.geojson',
    JSON.stringify(roundFeatureCollection(enrichedManzanas)));

  // Overwrite responses.geojson with barrio_cleaned field added.
  fs.writeFileSync('./public/data/responses.geojson',
    JSON.stringify(roundFeatureCollection(responses)));

  console.log('✅ Preprocessing complete. Files saved:');
  console.log(' - enriched-manzanas.geojson');
  console.log(' - responses.geojson (with barrio_cleaned)');
};

main();
