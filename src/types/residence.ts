export type Address = {
  street: string
  complement?: string
  zipCode: string
  city: string
  codeQualite: string
}

export type GeranceRef = {
  geranceId: string
  serviceType: "serviceSyndic" | "geranceLocative"
  agentMail?: string
}

export type Residence = {
  id: string
  name: string
  address: Address
  mail_contact?: string
  csmembers?: string[]
  totalLot: number
  geranceRef?: GeranceRef
  // Géocodées paresseusement côté backoffice (API Adresse/BAN, cf.
  // lib/geocode.ts) pour la carte des résidences - absentes tant qu'une
  // résidence n'a pas encore été géocodée. Champ propre au backoffice,
  // ignoré par l'app mobile (ne fait pas partie de son modèle Residence).
  lat?: number
  lng?: number
}

export const emptyAddress: Address = {
  street: "",
  complement: "",
  zipCode: "",
  city: "",
  codeQualite: "60",
}
