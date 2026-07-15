import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Config du projet Firebase konodal-dev (partagé avec l'app Flutter),
// app Web dédiée "Konodal Backoffice" enregistrée séparément côté Firebase
// pour un suivi distinct de l'app mobile. Valeurs non secrètes (protégées
// par firestore.rules/storage.rules, pas par leur confidentialité), mais
// gardées en variables d'environnement par hygiène/portabilité - cf.
// .env.example pour le format attendu, .env (non versionné) pour les
// valeurs réelles.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
