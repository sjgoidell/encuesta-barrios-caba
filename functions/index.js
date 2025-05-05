
const functions = require('firebase-functions')
const admin = require('firebase-admin')
const { google } = require('googleapis')

admin.initializeApp()

// Use environment variables or secure config in production
const SHEET_ID = '1KIpiyw6b8jwq8wSM5OmAqhiRgySgGMVXCj8ftuPt9Gk' // from the URL
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

const auth = new google.auth.JWT(
  functions.config().google_sheets.client_email,
  null,
  functions.config().google_sheets.private_key.replace(/\\n/g, '\n'),
  ['https://www.googleapis.com/auth/spreadsheets']
)

const sheets = google.sheets({ version: 'v4', auth })

const { onDocumentCreated } = require("firebase-functions/v2/firestore")

exports.onNewResponse = onDocumentCreated("responses/{docId}", async (event) => {
  const snap = event.data
  const data = snap.data()

    const row = [
      data.email || '',
      data.barrioName || '',
      data.pinLocation?.lat || '',
      data.pinLocation?.lng || '',
      data.claseSocial || '',
      data.genero || '',
      data.comunidad || '',
      data.userRegion || '',
      data.submittedAt?.toDate?.().toISOString() || ''
    ]

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A1',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [row]
      }
    })

    console.log('✅ Row added to Google Sheet')
  })
