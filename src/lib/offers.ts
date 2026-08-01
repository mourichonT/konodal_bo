// Endpoints publics (aucune authentification Firebase) consommés par
// OfferPage.tsx - même pattern que SharedInterventionPage/sinistres.ts
// (@https_fn.on_request, appelés en fetch brut plutôt qu'en httpsCallable),
// URL de base construite dynamiquement (région + projet réels) plutôt que
// codée en dur.
const FUNCTIONS_BASE = `https://europe-west9-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net`

export type Offer = {
  geranceName: string | null
  serviceLabel: string | null
  roleLabel: string
  existingSeatCount: number
  pricePerSeatCents: number | null
  priceCurrency: string | null
  // Paiement déjà confirmé côté serveur (webhook Stripe déjà passé) - permet
  // de proposer directement "définir mon mot de passe" si l'invité rouvre le
  // lien de l'email après coup, sans dépendre du seul ?checkout=success.
  redeemed: boolean
}

// pending: true - le paiement n'a pas encore été confirmé côté serveur
// (léger délai possible entre la redirection du navigateur et la livraison
// du webhook Stripe, cf. request_offer_password_link) : à réessayer côté
// appelant plutôt qu'une erreur.
export type PasswordLinkResult = { link: string; pending?: false } | { pending: true }

async function parseJsonOrThrow<T>(response: Response, fallbackError: string): Promise<T> {
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || fallbackError)
  return body as T
}

export async function getOffer(token: string): Promise<Offer> {
  const response = await fetch(`${FUNCTIONS_BASE}/get_offer?token=${encodeURIComponent(token)}`)
  return parseJsonOrThrow<Offer>(response, "Ce lien n'est plus valide ou a expiré.")
}

export async function createOfferCheckoutSession(token: string, quantity: number): Promise<{ url: string }> {
  const response = await fetch(`${FUNCTIONS_BASE}/create_offer_checkout_session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, quantity, origin: window.location.origin }),
  })
  return parseJsonOrThrow<{ url: string }>(response, "Échec de l'ouverture du paiement.")
}

export async function requestOfferPasswordLink(token: string): Promise<PasswordLinkResult> {
  const response = await fetch(`${FUNCTIONS_BASE}/request_offer_password_link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  })
  // 202 (pending) est un `response.ok` normal (pas une erreur) : le paiement
  // n'a simplement pas encore été confirmé côté serveur, cf. type PasswordLinkResult.
  return parseJsonOrThrow<PasswordLinkResult>(response, "Impossible de générer le lien.")
}
