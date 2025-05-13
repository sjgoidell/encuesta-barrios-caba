const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { google } = require('googleapis');

admin.initializeApp();

// Use environment variables or secure config in production
const SHEET_ID = '1KIpiyw6b8jwq8wSM5OmAqhiRgySgGMVXCj8ftuPt9Gk'; // from the URL
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const auth = new google.auth.JWT(
  functions.config().google_sheets.client_email,
  null,
  functions.config().google_sheets.private_key.replace(/\\n/g, '\n'),
  SCOPES
);

const sheets = google.sheets({ version: 'v4', auth });

// ✅ Replace v2 trigger with v1-compatible onCreate Firestore trigger
exports.onNewResponse = functions
  .region('us-central1')
  .firestore
  .document('responses/{docId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();

    // 🔍 Log the raw data to check what format is coming through
    console.log("✅ New response received:", JSON.stringify(data));

    // 🕒 Handle both Firestore Timestamp and plain strings
    let formattedDate = '';
    const rawDate = data.submittedAt;
    if (rawDate?.toDate instanceof Function) {
      formattedDate = rawDate.toDate().toISOString();
    } else if (typeof rawDate === 'string') {
      try {
        formattedDate = new Date(rawDate).toISOString();
      } catch (e) {
        console.error("❌ Could not parse submittedAt:", rawDate);
      }
    }

    const pinLocationString = data.pinLocation
      ? JSON.stringify(data.pinLocation)
      : '';

    const row = [
      data.barrioName || '',
      getColorForBarrio(data.barrioName || ''),
      // pinLocationString,
      data.comments || '',
      data.email || '',
      data.age || '',
      data.yearsInBarrio || '',
      data.comunidad || '',
      data.situacionDomicilio || '',
      data.userRegion || '',
      data.language || '',
      data.deviceType || '',
      data.mapClickCount || 0,
      data.canContact || '',
      data.deviceType || '',
      formattedDate || ''
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A1',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [row]
      }
    });

    console.log("✅ Row added to Google Sheet");
  });
