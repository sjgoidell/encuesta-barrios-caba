/**
 * export.cjs  —  Firebase responses -> responses.csv (PRIVATE analysis export).
 *
 * ⚠️ PII WARNING: responses.csv contains personal data (email, age, religion,
 * birthplace, education, comments, contact flags, plus home coordinates and
 * polygon). It is intended for the survey owner's PRIVATE analysis ONLY.
 *
 *   - responses.csv is gitignored and MUST NOT be committed or published.
 *   - Do NOT place this file anywhere served publicly (e.g. /public).
 *   - The public map uses public/data/responses.geojson, which is stripped to
 *     a privacy-safe schema by export-geojson.cjs — do not confuse the two.
 *
 * If you ever need to share this CSV, remove the personal columns first.
 *
 * Run: node export.cjs
 */

const fs = require('fs')
const admin = require('firebase-admin')
const serviceAccount = require('/Users/Goidell Sam/encuesta-barrios-caba-personal/firebase-service-account.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

const db = admin.firestore()

async function exportData() {
  const snapshot = await db.collection('responses').get()
  const rows = []

  snapshot.forEach(doc => {
    const data = doc.data()

    const pinLat = data.pinLocation?.lat || ''
    const pinLng = data.pinLocation?.lng || ''
    const polygonRaw = data.polygon || ''
    const polygonObj = polygonRaw ? JSON.parse(polygonRaw) : null
    const polygonCoords = polygonObj?.geometry?.coordinates?.[0]?.map(coord => coord.join(' ')).join(' | ') || ''

    rows.push({
      email: data.email || '',
      age: data.age || '',
      yearsInBarrio: data.yearsInBarrio || '',
      barrioName: data.barrioName || '',
      pinLat,
      pinLng,
      comments: data.comments || '',
      religionAffiliation: data.religionAffiliation || '',
      selectedReligion: data.selectedReligion || '',
      otherReligion: data.otherReligion || '',
      gruposbarrio: data.gruposbarrio || '',
      gruposbarriodetalle: data.gruposbarriodetalle || '', 
      comunidadesSeleccionadas: Array.isArray(data.comunidadesSeleccionadas) ? data.comunidadesSeleccionadas.join('; ') : '',
      otraComunidadTexto: data.otraComunidadTexto || '',
      nacimientoLugar: data.nacimientoLugar || '',
      provinciaNacimiento: data.provinciaNacimiento || '',
      paisNacimiento: data.paisNacimiento || '',
      situacionDomicilio: data.situacionDomicilio || '',
      nivelEducacionJefe: data.nivelEducacionJefe || '',
      canContact: data.canContact || '',
      submittedAt: data.submittedAt?.toDate?.().toISOString() || '',
      sessionDuration: data.sessionDuration || '',
      deviceType: data.deviceType || '',
      language: data.language || '',
      userRegion: data.userRegion || '',
      mapClickCount: data.mapClickCount || '',
      polygonCoords // ✅ for basic visualization in Sheets
    })
  })

  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(h => JSON.stringify(row[h] || '')).join(','))
  ].join('\n')

  fs.writeFileSync('responses.csv', csv)
  console.log('✅ Exported to responses.csv')
}

exportData()
