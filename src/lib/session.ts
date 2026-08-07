// Identifiant de session stocké en localStorage (donc par device/navigateur,
// partagé entre onglets d'une même session) - comparé à users/{uid}.activeSessionId
// pour détecter qu'un autre device s'est connecté avec le même compte
// (cf. auth-context.tsx). try/catch : navigation privée stricte (Safari) peut
// faire lever localStorage, on dégrade alors silencieusement (pas de garde-fou
// multi-session sur ce device plutôt que bloquer la connexion).
const STORAGE_PREFIX = "konodal_bo_session:"

function storageKey(uid: string): string {
  return `${STORAGE_PREFIX}${uid}`
}

export function getLocalSessionId(uid: string): string | null {
  try {
    return localStorage.getItem(storageKey(uid))
  } catch {
    return null
  }
}

export function setLocalSessionId(uid: string, sessionId: string): void {
  try {
    localStorage.setItem(storageKey(uid), sessionId)
  } catch {
    // ignoré, cf. commentaire d'en-tête
  }
}

export function clearLocalSessionId(uid: string): void {
  try {
    localStorage.removeItem(storageKey(uid))
  } catch {
    // ignoré, cf. commentaire d'en-tête
  }
}
