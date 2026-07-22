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
  // uid Firebase Auth de l'agent précisément choisi pour cette résidence -
  // PAS un email (cf. GeranceRef.agentUid côté Dart, gerance_ref.dart) :
  // c'est ce champ que firestore_agency_repository.dart lit réellement pour
  // résoudre le contact syndic/gérance affiché au résident, avec repli sur
  // le premier uid de serviceSyndicAgentUids/geranceLocativeAgentUids si
  // absent.
  agentUid?: string
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
  // Contacts rattachés à cette résidence (collection racine "contacts",
  // partagée - cf. konodal_app/lib/models/pages_models/contact.dart). Vit
  // ici plutôt que sur le contact lui-même : Firestore n'a pas de sécurité
  // par champ, un tableau de résidences exposé sur un contact partagé
  // ferait fuiter les résidences des autres agences à chacune d'elles.
  contactRefs?: Record<string, boolean>
}

export const emptyAddress: Address = {
  street: "",
  complement: "",
  zipCode: "",
  city: "",
  codeQualite: "60",
}
