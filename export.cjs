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
            age: data.age || '',
            yearsInBarrio: data.yearsInBarrio || '',
            barrioName: data.barrioName || '',
            pinLocation: JSON.stringify(data.pinLocation || ''),
            comments: data.comments || '',
            canContact: data.canContact || '',
            religionAffiliation: data.religionAffiliation || '',
            selectedReligion: data.selectedReligion || '',
            otherReligion: data.otherReligion || '',
            comunidadesSeleccionadas: Array.isArray(data.comunidadesSeleccionadas) ? data.comunidadesSeleccionadas.join('; ') : '',
            otraComunidadTexto: data.otraComunidadTexto || '',
            nacimientoLugar: data.nacimientoLugar || '',
            provinciaNacimiento: data.provinciaNacimiento || '',
            paisNacimiento: data.paisNacimiento || '',
            situacionDomicilio: data.situacionDomicilio || '',
            submittedAt: data.submittedAt?.toDate?.().toISOString() || '',
            sessionDuration: data.sessionDuration || '',
            deviceType: data.deviceType || '',
            language: data.language || '',
            userRegion: data.userRegion || '',
            mapClickCount: data.mapClickCount || '',
            polygon: data.polygon || ''
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
