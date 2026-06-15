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

// Deterministic color for a barrio name, stable across invocations (each Cloud
// Function call is isolated, so we can't keep an in-memory color map). Fixes a
// crash: getColorForBarrio was referenced below but never defined, so
// onNewResponse threw on every submission and the Sheet sync never ran (P4C).
const COLOR_PALETTE = [
  '#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#A133FF',
  '#33FFF5', '#F5FF33', '#FF8F33', '#33FF8F', '#8F33FF',
];
function getColorForBarrio(barrio) {
  const s = String(barrio || '');
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return COLOR_PALETTE[hash % COLOR_PALETTE.length];
}

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
