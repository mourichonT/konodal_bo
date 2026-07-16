// Reflète exactement le cycle de statut déjà géré côté app mobile
// (icon_modify_or_delette.dart, Stepper "Modifier le statut") - le
// backoffice lit/écrit le même champ `statut`, aucune modif app nécessaire
// au-delà de la règle Firestore de lecture.
export const SINISTRE_STATUSES = ["Non envoyé", "Transmis", "En cours", "Terminé"] as const
export type SinistreStatus = (typeof SINISTRE_STATUSES)[number]

export const sinistreStatusLabels: Record<SinistreStatus, string> = {
  "Non envoyé": "À venir",
  Transmis: "À traiter",
  "En cours": "En cours",
  Terminé: "Terminé",
}

export type Sinistre = {
  id: string
  residenceId: string
  title: string
  description: string
  statut: string
  pathImage: string
  isVideo: boolean
  locationElement: string
  locationFloor: string
  timeStamp: Date | null
  declaredDate: Date | null
  user: string
}
