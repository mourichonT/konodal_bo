// Miroir de AccessPoint/AccessPointType côté app mobile (connectkasa,
// lib/models/pages_models/access_point.dart) - un moyen d'accès physique
// (portail résidence, entrée d'un bâtiment précis), affiché au prestataire
// sur la page de partage d'une intervention (cf. get_shared_intervention,
// functions_python/main.py).
export const AccessPointType = {
  code: "code",
  badge: "badge",
  cle: "cle",
  autre: "autre",
} as const
export type AccessPointTypeValue = (typeof AccessPointType)[keyof typeof AccessPointType]

export const accessPointTypeLabels: Record<AccessPointTypeValue, string> = {
  [AccessPointType.code]: "Digicode",
  [AccessPointType.badge]: "Badge",
  [AccessPointType.cle]: "Clé",
  [AccessPointType.autre]: "Autre",
}

export type AccessPoint = {
  type: AccessPointTypeValue
  // Uniquement pertinent pour type == code.
  code?: string
  // Complément libre (ex: "Badge à retirer à la loge du gardien") - seul
  // champ utile pour badge/cle/autre.
  details?: string
}
