// Résout un aperçu de lien (titre/domaine/image) via la Cloud Function
// fetch_link_preview (functions_python/main.py) - même mécanisme que
// LinkPreviewController côté app mobile (konodal_app), réutilisé ici pour
// permettre d'attacher un lien à une communication depuis le backoffice.
// Le modèle stocké (Post.link, cf. link_preview.dart) est résolu une seule
// fois à la création, jamais re-fetché à l'affichage.
const FUNCTIONS_BASE = `https://europe-west9-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net`

export type LinkPreview = {
  url: string
  domain: string
  title?: string
  imageUrl?: string
  favicon?: string
}

// Lève une erreur (message déjà adapté à l'affichage) plutôt que de renvoyer
// null : contrairement à LinkPreviewController côté app, l'appelant ici n'a
// qu'un seul champ URL à corriger immédiatement, pas de second essai
// silencieux à prévoir - la modale de création doit bloquer la publication
// avec un message clair plutôt qu'enregistrer un lien resté vide.
export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  const trimmed = url.trim()
  let response: Response
  try {
    response = await fetch(`${FUNCTIONS_BASE}/fetch_link_preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ params: { url: trimmed } }),
    })
  } catch {
    throw new Error("Impossible de contacter le service d'aperçu de lien.")
  }

  // Method Not Allowed/Bad Request renvoient du texte brut (pas de JSON) -
  // les échecs métier (SSRF, page inaccessible) renvoient eux un JSON avec
  // `error`, parfois avec un statut 200 malgré l'échec (cf. commentaire
  // fetch_link_preview côté fonction) : on ne peut donc pas se fier au seul
  // code HTTP pour distinguer succès/échec.
  const data = await response.json().catch(() => null)
  if (!data || data.error || !data.url) {
    throw new Error(data?.error || "Aperçu impossible pour cette URL, vérifiez qu'elle est correcte.")
  }

  return {
    url: data.url as string,
    domain: data.domain as string,
    title: data.title || undefined,
    imageUrl: data.imageUrl || undefined,
    favicon: data.favicon || undefined,
  }
}
