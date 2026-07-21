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
  // Champ backoffice uniquement - posé par create_shared_rapport
  // (functions_python/main.py) dès qu'un compte-rendu de fin d'intervention
  // est soumis via le lien de partage prestataire.
  termine?: boolean
  // Champs backoffice uniquement, posés par reschedule_shared_intervention
  // lors d'une reprogrammation depuis la page de partage prestataire :
  // previousEventId pointe, sur la NOUVELLE intervention, vers celle qu'elle
  // remplace ; reporte est posé sur l'ANCIENNE intervention (celle qui garde
  // sa date d'origine) pour que le calendrier l'affiche distinctement.
  previousEventId?: string
  reporte?: boolean
  // Champ backoffice uniquement - posé depuis EventFormDialog ("Annuler
  // l'intervention", en mode édition uniquement) via cancelEvent(). Comme
  // reporte, verrouille définitivement l'intervention (plus d'envoi ni de
  // modification possible) mais avec un statut distinct (rouge, pas jaune) -
  // l'annulation est une décision explicite du BO, pas la conséquence d'une
  // reprogrammation côté prestataire.
  annule?: boolean
}
