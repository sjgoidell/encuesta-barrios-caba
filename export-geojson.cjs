const fs = require('fs')
const admin = require('firebase-admin')
const serviceAccount = require('/Users/Goidell Sam/encuesta-barrios-caba-personal/firebase-service-account.json')
const colorPalette = [
  '#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#A133FF',
  '#33FFF5', '#F5FF33', '#FF8F33', '#33FF8F', '#8F33FF'
]

const barrioColorMap = new Map()
let colorIndex = 0

function getColorForBarrio(barrio) {
  if (!barrioColorMap.has(barrio)) {
    barrioColorMap.set(barrio, colorPalette[colorIndex % colorPalette.length])
    colorIndex++
  }
  return barrioColorMap.get(barrio)
}


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

        features.push({
          type: 'Feature',
          geometry: parsed.geometry,
          properties: {
            barrio: data.barrioName || '',
            fillColor: getColorForBarrio(data.barrioName || ''),
            pinLocation: data.pinLocation || '',
            comments: data.comments || '',
            email: data.email || '',
            age: data.age || '',
            yearsInBarrio: data.yearsInBarrio || '',
            comunidad: data.comunidad || '',
            situacionDomicilio: data.situacionDomicilio || '',
            userRegion: data.userRegion || '',
            language: data.language || '',
            deviceType: data.deviceType || '',
            mapClicks: data.mapClickCount || 0,
            canContact: data.canContact || '',
            deviceType: data.deviceType || '',
            timestamp: data.submittedAt?.toDate?.().toISOString() || ''
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

  fs.writeFileSync('responses.geojson', JSON.stringify(geojson, null, 2))
  console.log('✅ Exported to responses.geojson')
}

exportToGeoJSON()
