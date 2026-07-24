export const COMMUNICATION_AUDIENCES = ["all", "proprietaires"] as const
export type CommunicationAudience = (typeof COMMUNICATION_AUDIENCES)[number]

export const communicationAudienceLabels: Record<CommunicationAudience, string> = {
  all: "Tous les utilisateurs",
  proprietaires: "Uniquement les propriétaires",
}

export type Communication = {
  id: string
  residenceId: string
  title: string
  description: string
  pathImage: string
  isVideo: boolean
  creationDate: Date | null
  user: string
  audience: CommunicationAudience
  // Regroupe les copies d'une même publication multi-résidences (une copie =
  // un post par résidence choisie, cf. createCommunication) - partagé par
  // toutes les copies créées en une seule soumission du formulaire BO.
  // Retombe sur l'id du post lui-même si absent (anciennes communications,
  // ou copie isolée), pour toujours former un groupe même minimal.
  groupId: string
}
