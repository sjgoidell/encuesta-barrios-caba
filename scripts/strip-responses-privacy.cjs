/**
 * strip-responses-privacy.cjs  —  ONE-TIME privacy cleanup (P3-PRIVACY).
 *
 * Purpose:
 *   Rewrite public/data/responses.geojson in place, dropping every personal
 *   field and keeping ONLY the minimal schema the public map needs:
 *     - geometry            : the respondent's home polygon
 *     - properties.id       : a random respondent ID (generated here; the
 *                             source file currently has no ID field)
 *     - properties.barrio   : barrio name (read by the map + /db view)
 *     - properties.pinLocation : the point marking where they live (the live
 *                             map derives pins from this at runtime)
 *
 *   All other fields (email, age, religion, birthplace, education, comments,
 *   contact flags, device/region, timestamps, etc.) are removed.
 *
 * Why a separate one-time script:
 *   The Firebase export (export-geojson.cjs) cannot be re-run on this machine
 *   (it needs a service-account key at a path outside the project). This
 *   script sanitizes the already-exported file so the next push removes the
 *   exposed PII from HEAD. Going forward, export-geojson.cjs is hardened to
 *   emit only this schema, so the reduced shape can't regress.
 *
 *   NOTE: this removes PII from the current file only — it does NOT scrub git
 *   history. History remediation is tracked as a separate decision.
 *
 * Usage:  node strip-responses-privacy.cjs
 */

const fs = require('fs');
const crypto = require('crypto');

const FILE = 'public/data/responses.geojson';

// Fields that are intentionally preserved in properties. Everything else is dropped.
const KEEP = ['barrio', 'pinLocation'];

function main() {
  const raw = fs.readFileSync(FILE, 'utf8');
  const data = JSON.parse(raw);

  if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    throw new Error(`${FILE} is not a FeatureCollection`);
  }

  const beforeKeys = data.features.length
    ? Object.keys(data.features[0].properties || {})
    : [];

  const cleaned = data.features.map((feature) => {
    const src = feature.properties || {};
    const properties = { id: crypto.randomUUID() };
    for (const key of KEEP) {
      if (src[key] !== undefined) properties[key] = src[key];
    }
    return {
      type: 'Feature',
      geometry: feature.geometry, // home polygon, untouched
      properties,
    };
  });

  const out = { type: 'FeatureCollection', features: cleaned };
  fs.writeFileSync(FILE, JSON.stringify(out, null, 2));

  const afterKeys = cleaned.length ? Object.keys(cleaned[0].properties) : [];
  console.log(`✅ Sanitized ${FILE}`);
  console.log(`   features: ${cleaned.length}`);
  console.log(`   dropped fields: ${beforeKeys.filter((k) => !afterKeys.includes(k)).join(', ') || '(none)'}`);
  console.log(`   kept fields:    ${afterKeys.join(', ')}`);
}

main();
