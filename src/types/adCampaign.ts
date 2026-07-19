// Campagne publicitaire partagée entre résidences (collection racine
// "adCampaigns"), gérée uniquement par le backoffice - l'app mobile ne fait
// que lire la campagne active pour sa résidence et incrémenter
// impressionCount/clickCount (cf. AdCampaign côté Flutter, adv_widget.dart).
export type AdCampaign = {
  id: string
  // Usage backoffice uniquement (identification dans la liste) - l'app
  // mobile ne lit jamais ce champ.
  name: string
  imageUrl: string
  targetUrl: string
  targetResidenceIds: string[]
  // startDate/endDate : format ISO "YYYY-MM-DD" (même convention que
  // DateInput/SinistresListPage). `active` n'est plus jamais écrit par le BO
  // - c'est la Cloud Function de réconciliation (functions_python/main.py,
  // reconcile_ad_campaigns_*) qui l'active/désactive automatiquement selon
  // la période et le quota de 3 campagnes actives par département.
  startDate: string
  endDate: string
  createdAt: string | null
  // Recalculé et écrit uniquement côté backend (jamais par le BO) - affiché
  // en lecture seule dans PublicitesPage.
  targetDepartments: string[]
  active: boolean
  impressionCount: number
  clickCount: number
  // Répartition par résidence - écrite par l'app (FieldValue.increment sur
  // un chemin pointé), jamais par le BO. Sert à calculer la répartition par
  // département affichée dans AdCampaignDetailPage.
  impressionsByResidence: Record<string, number>
  clicksByResidence: Record<string, number>
}

export type AdCampaignInput = {
  name: string
  imageUrl: string
  targetUrl: string
  targetResidenceIds: string[]
  startDate: string
  endDate: string
}

export type AdCampaignConfig = {
  displayFrequency: number
}
