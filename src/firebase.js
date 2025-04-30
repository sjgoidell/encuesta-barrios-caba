import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

// Your actual config from Firebase Console:
const firebaseConfig = {
    apiKey: "AIzaSyCUG0cta_JsQOzeQXgE3P5M6_rzR4oLUz8",
    authDomain: "encuesta-barrios-caba.firebaseapp.com",
    projectId: "encuesta-barrios-caba",
    storageBucket: "encuesta-barrios-caba.firebasestorage.app",
    messagingSenderId: "286815642621",
    appId: "1:286815642621:web:b3441ac41d70e387fcef94"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

export { db }
