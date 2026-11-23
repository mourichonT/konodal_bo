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

// Syndicat des copropriétaires, pour la facturation électronique des
// artisans de Konodal Pro (pro.py, pro_create_facture) : un syndicat
// assujetti à la TVA et doté d'un SIREN reçoit des factures électroniques ;
// sinon (le cas général), l'artisan fait de l'e-reporting. Champ propre au
// backoffice et à Konodal Pro, ignoré par l'app mobile.
export type SyndicatInfo = {
  siren?: string
  assujettiTva?: boolean
}

export type Residence = {
  id: string
  name: string
  address: Address
  syndicat?: SyndicatInfo
  // Autres adresses de la résidence (autre entrée, autre voie qui la
  // dessert) - même champ que Residence.alternateAddresses côté app mobile
  // (residence.dart) : la recherche de résidence à l'inscription et le
  // contrôle du justificatif de domicile (verify_home_proof_document) les
  // acceptent comme l'adresse principale.
  alternateAddresses?: Address[]
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
  // Résidence de démonstration de l'app (posé par le script de démo,
  // 17/11/2026) : jamais montrée dans le BO, cf. withoutDemo
  // (lib/residences.ts).
  demo?: boolean
}

export const emptyAddress: Address = {
  street: "",
  complement: "",
  zipCode: "",
  city: "",
  codeQualite: "60",
}
