import type { Address } from "@/types/residence"

export type Agent = {
  name_agent: string
  surname_agent: string
  mail?: string
  phone?: string
  // Posé par inviteAgencyAccount une fois le compte BO créé/lié (uid
  // Firebase Auth) - absent tant que cet agent n'a jamais été invité. Le
  // statut "actif" réel se lit en croisant ce uid avec
  // serviceSyndicAgentUids/geranceLocativeAgentUids (uid présent mais pas
  // dans le tableau = accès révoqué, pas "jamais invité").
  uid?: string
}

export type AgencyDept = {
  mail: string
  phone: string
  agents: Agent[]
  // Compte BO lié à l'adresse GÉNÉRIQUE du service (cas "une adresse
  // globale par service", sans agent nommé individuel) - même mécanique que
  // Agent.uid, posée par inviteAgencyAccount, jamais saisie à la main.
  uid?: string
}

export type ServiceType = "serviceSyndic" | "geranceLocative"

export const serviceTypeLabels: Record<ServiceType, string> = {
  serviceSyndic: "Syndic",
  geranceLocative: "Gérance locative",
}

export type Gerance = {
  id: string
  name: string
  address: Address
  services: Partial<Record<ServiceType, AgencyDept>>
  // Tableaux plats d'uid Firebase Auth - jamais écrits directement depuis le
  // BO (firestore.rules l'interdit explicitement, même pour une Agence
  // éditant sa propre fiche) : uniquement maintenus par les Cloud Functions
  // invite_agency_account/revoke_agency_account (functions_python/main.py),
  // lues ici pour afficher le statut "compte actif" de chaque agent et
  // résoudre le périmètre résidences d'un compte agence/agent connecté (cf.
  // isSyndicAgent/isGeranceLocativeAgent côté firestore.rules).
  serviceSyndicAgentUids?: string[]
  geranceLocativeAgentUids?: string[]
}

export const emptyAgencyDept: AgencyDept = {
  mail: "",
  phone: "",
  agents: [],
}
