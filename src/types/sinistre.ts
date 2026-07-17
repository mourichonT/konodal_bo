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

// Couleur partagée par statut - même teinte que les colonnes du Kanban
// (columnAccent) et les badges de la vue Liste (statusBadgeClass).
export const sinistreStatusTextClass: Record<SinistreStatus, string> = {
  "Non envoyé": "text-slate-600",
  Transmis: "text-amber-600",
  "En cours": "text-sky-600",
  Terminé: "text-emerald-600",
}

export const sinistreStatusDotClass: Record<SinistreStatus, string> = {
  "Non envoyé": "bg-slate-400",
  Transmis: "bg-amber-400",
  "En cours": "bg-sky-400",
  Terminé: "bg-emerald-500",
}

// Préférence utilisateur persistée (survit aux rechargements/onglets),
// partagée entre le Kanban et la vue Liste - un simple booléen ne justifie
// pas un champ Firestore dédié sur le compte, localStorage suffit ici.
export const SHOW_NON_DECLARES_KEY = "konodal-bo:sinistres-show-non-declares"

// Champ backoffice uniquement (même précaution que priority/closedDate) :
// permet de sortir un ticket "Terminé" du Kanban (libère la colonne) sans
// changer son statut réel - il reste retrouvable dans la vue Liste via le
// filtre "Afficher les tickets archivés".
export const SHOW_ARCHIVED_KEY = "konodal-bo:sinistres-show-archived"

// Champ propre au backoffice - absent du modèle Dart (Post.toMap()/fromMap()
// ignore silencieusement les clés inconnues), jamais lu ni écrit par l'app.
// `updatePost()` écrit via toUpdateMap() (update() partiel, pas set()), donc
// aucun risque que l'app efface ce champ lors d'un changement de statut.
export const SINISTRE_PRIORITIES = ["basse", "normale", "haute"] as const
export type SinistrePriority = (typeof SINISTRE_PRIORITIES)[number]

export const sinistrePriorityLabels: Record<SinistrePriority, string> = {
  basse: "Basse",
  normale: "Normale",
  haute: "Haute",
}

export type Sinistre = {
  id: string
  residenceId: string
  title: string
  description: string
  statut: string
  priority: SinistrePriority
  pathImage: string
  isVideo: boolean
  locationElement: string
  locationFloor: string
  creationDate: Date | null
  declaredDate: Date | null
  closedDate: Date | null
  inProgressDate: Date | null
  // Champ backoffice uniquement (même précaution que priority/closedDate) :
  // date de la dernière intervention programmée depuis ce ticket
  // ("Programmer une intervention", SinistreDetailPage) - écrase la
  // précédente si plusieurs interventions sont programmées dans le temps.
  interventionDate: Date | null
  archived: boolean
  user: string
}
