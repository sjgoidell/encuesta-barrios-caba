/**
 * export-geojson.cjs  —  Firebase responses -> public/data/responses.geojson
 *
 * PRIVACY-ENFORCED SCHEMA (P3-PRIVACY):
 *   This script intentionally emits ONLY the minimal fields the public map
 *   needs. Personal data (email, age, religion, birthplace, education,
 *   comments, contact flags, device/region, timestamps, etc.) must NEVER be
 *   written to the public GeoJSON. The output schema is:
 *     - geometry              : the respondent's home polygon
 *     - properties.id         : the Firestore document id (random, stable)
 *     - properties.barrio     : barrio name (read by the map + /db view)
 *     - properties.pinLocation: the point marking where they live
 *
 *   Do NOT add personal fields to the `properties` object below. Doing so
 *   re-exposes individual-level data publicly. If a new field is genuinely
 *   needed by the map, confirm it is non-personal first.
 *
 * Run: node export-geojson.cjs
 */

const fs = require('fs')
const admin = require('firebase-admin')
const serviceAccount = require('/Users/Goidell Sam/encuesta-barrios-caba-personal/firebase-service-account.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

const db = admin.firestore()

// CABA bounding box. Polygons drawn entirely outside the city (e.g. Olivos,
// Martínez, or junk) are "orphans" — they never match a CABA manzana, so they
// just add clutter to the límites view and file size. Drop them (P4C-ORPHANS).
const CABA = { W: -58.53, E: -58.34, S: -34.70, N: -34.53 }
function touchesCABA(geometry) {
  let ring = geometry && geometry.coordinates
  if (!ring) return false
  while (Array.isArray(ring[0][0])) ring = ring[0]
  return ring.some(([lng, lat]) => lng >= CABA.W && lng <= CABA.E && lat >= CABA.S && lat <= CABA.N)
}

async function exportToGeoJSON() {
  const snapshot = await db.collection('responses').get()
  const features = []
  let orphans = 0

  snapshot.forEach(doc => {
    const data = doc.data()

    if (data.polygon) {
      try {
        const parsed = JSON.parse(data.polygon)

        // P4C-ORPHANS: skip polygons drawn entirely outside CABA.
        if (!touchesCABA(parsed.geometry)) { orphans++; return }

        // Minimal, privacy-safe schema only. See header before adding fields.
        features.push({
          type: 'Feature',
          geometry: parsed.geometry,
          properties: {
            id: doc.id,
            barrio: data.barrioName || '',
            pinLocation: JSON.stringify(data.pinLocation || '')
          }
        })
      } catch (e) {
        console.warn(`⚠️ Invalid polygon in ${doc.id}, skipping.`)
      }
    }
  })

  const geojson = {
    type: 'FeatureCollection',
    features
  }

  fs.writeFileSync('public/data/responses.geojson', JSON.stringify(geojson))
  console.log(`✅ Exported ${features.length} features to public/data/responses.geojson (privacy-safe schema; dropped ${orphans} orphan polygons outside CABA)`)
}

exportToGeoJSON()
