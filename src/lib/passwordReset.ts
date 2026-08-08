// Remplace FirebaseAuth.sendPasswordResetEmail (template géré uniquement via
// la Console Firebase, sans HTML libre) par la Cloud Function
// send_password_reset_email (functions_python/main.py, @https_fn.on_request) -
// même mécanisme que le flux Flutter (auth_controller.dart) : un vrai lien
// d'action Firebase Auth généré côté serveur (Admin SDK,
// generate_password_reset_link vers konodal.com/portail/reset-password),
// habillé dans un email HTML personnalisé envoyé via le pipeline SMTP OVH
// déjà utilisé pour les autres emails de l'app. Appel fetch brut (pas
// httpsCallable), même convention que lib/offers.ts/lib/sinistres.ts.
const FUNCTIONS_BASE = `https://europe-west9-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net`

// Aligné sur les codes renvoyés par la Cloud Function (et déjà consommés par
// auth_controller.dart côté app mobile) - "user-not-found" est renvoyé
// volontairement (pas de protection anti-énumération sur ce flux, décision
// produit déjà actée côté fonction/app mobile).
export type PasswordResetErrorCode = "user-not-found" | "invalid-email" | "unknown"

export async function sendPasswordResetEmail(email: string): Promise<void> {
  const response = await fetch(`${FUNCTIONS_BASE}/send_password_reset_email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  })
  if (response.ok) return

  const body = await response.json().catch(() => null)
  const code: PasswordResetErrorCode =
    body?.error === "user-not-found" || body?.error === "invalid-email" ? body.error : "unknown"
  throw new Error(code)
}
