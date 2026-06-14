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

async function exportToGeoJSON() {
  const snapshot = await db.collection('responses').get()
  const features = []

  snapshot.forEach(doc => {
    const data = doc.data()

    if (data.polygon) {
      try {
        const parsed = JSON.parse(data.polygon)

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

  fs.writeFileSync('public/data/responses.geojson', JSON.stringify(geojson, null, 2))
  console.log(`✅ Exported ${features.length} features to public/data/responses.geojson (privacy-safe schema)`)
}

exportToGeoJSON()
