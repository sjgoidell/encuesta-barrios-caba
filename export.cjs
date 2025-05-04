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
    rows.push({
      email: data.email || '',
      barrio: data.barrioName || '',
      lat: data.pinLocation?.lat || '',
      lng: data.pinLocation?.lng || '',
      polygon: data.polygon || '',
      claseSocial: data.claseSocial || '',
      genero: data.genero || '',
      comunidad: data.comunidad || '',
      timestamp: data.submittedAt ? data.submittedAt.toDate().toISOString() : ''
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
