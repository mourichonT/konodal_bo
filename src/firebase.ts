import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

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

// getAuth() lève sur une config incomplète (auth/invalid-api-key) dès
// l'import de ce module, donc avant que React ne monte quoi que ce soit : sans
// ce garde-fou, un .env incomplet se manifeste par une page blanche muette,
// l'erreur n'étant visible que dans la console. On échoue ici avec le nom des
// variables manquantes et l'environnement visé.
// measurementId exclu : il n'est présent que si Analytics est activé sur le
// projet (ce n'est pas le cas de konodal-prod) et le BO n'appelle jamais
// getAnalytics() - l'exiger ferait échouer une config par ailleurs valide.
const requiredKeys = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"] as const;
const missingKeys = requiredKeys.filter((key) => !firebaseConfig[key]);
if (missingKeys.length > 0) {
  throw new Error(
    `Config Firebase incomplète en mode "${import.meta.env.MODE}" : ${missingKeys.join(", ")} manquant(s). ` +
      `Renseigne .env.${import.meta.env.MODE} à partir de .env.example (config de l'app Web du projet Firebase visé).`
  );
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// KONODAL est un produit exclusivement francophone : sans ça, les emails
// d'action Firebase (reset de mot de passe...) et le lang= du lien généré
// suivent la langue du navigateur de l'utilisateur (souvent "en").
auth.languageCode = "fr";
export const db = getFirestore(app);
export const storage = getStorage(app);
// Région "europe-west9" : région globale du codebase functions_python
// (options.set_global_options(region="europe-west9") dans konodal_app/functions_python/main.py)
// où vivent invite_agency_account / revoke_agency_account - getFunctions() cible
// "us-central1" par défaut, précisé explicitement pour ne pas en dépendre.
export const functions = getFunctions(app, "europe-west9");

// Mode local (`npm run dev:emulateurs`, .env.emulateurs) : BO branché sur les
// émulateurs Firebase de konodal_pro/emulateurs (projet demo-konodal-pro,
// aucune ressource réelle). Les fonctions HTTP appelées par URL complète
// (FUNCTIONS_BASE de linkPreview, offers, passwordReset, sinistres) n'y
// passent pas et échouent sans effet.
if (import.meta.env.VITE_EMULATEURS === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9299", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8383);
  connectStorageEmulator(storage, "127.0.0.1", 9499);
  connectFunctionsEmulator(functions, "127.0.0.1", 5201);
}
