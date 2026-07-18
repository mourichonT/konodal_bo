// Reflète Post (type "events") côté app mobile - seul le sous-type
// "prestation" (appelé "intervention" côté BO) est géré par le backoffice
// (cf. mémoire scope-vision), les events "interne" (participatifs, gérés par
// les membres du Conseil Syndical) ne sont ni affichés ni modifiables ici.
// La VALEUR Firestore reste "prestation" (EventType.prestation côté app
// Dart) - seul le libellé et le nom de la constante changent côté BO.
export const EVENT_TYPE_INTERVENTION = "prestation"

export type ResidenceEvent = {
  id: string
  residenceId: string
  title: string
  description: string
  eventDate: Date | null
  prestaName: string
  pathImage: string
  creationDate: Date | null
  user: string
  // Champ backoffice uniquement (comme priority/archived sur Sinistre) -
  // absent du modèle Dart, ignoré silencieusement par l'app mobile. Posé
  // quand l'intervention est programmée depuis la fiche d'un sinistre
  // (SinistreDetailPage), pour retrouver le ticket d'origine.
  linkedSinistreId?: string
  // Champs backoffice uniquement (même précaution que linkedSinistreId) -
  // optionnels, renseignés depuis les structures/étages déclarés sur la
  // résidence (cf. types/structure.ts), jamais lus/écrits par l'app mobile.
  locationElement?: string
  locationFloor?: string
}
