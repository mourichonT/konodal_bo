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
}
