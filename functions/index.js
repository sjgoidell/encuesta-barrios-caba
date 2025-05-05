/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

const functions = require('firebase-functions')
const admin = require('firebase-admin')
const { google } = require('googleapis')

admin.initializeApp()

// Use environment variables or secure config in production
const SHEET_ID = '0' // from the URL
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
const serviceAccount = require('./service-account.json')

const auth = new google.auth.JWT(
  serviceAccount.client_email,
  null,
  serviceAccount.private_key,
  SCOPES
)

const sheets = google.sheets({ version: 'v4', auth })

exports.onNewResponse = functions.firestore
  .document('responses/{docId}')
  .onCreate(async (snap, context) => {
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
      new Date(data.submittedAt._seconds * 1000).toISOString()
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
