import type { Address } from "@/types/residence"

// Un "agent" n'est plus un objet saisi à la main (nom/prénom/email/
// téléphone) stocké séparément - il n'existe QUE s'il a déjà un compte BO
// invité, et son identité (nom/prénom/téléphone) se lit directement sur
// users/{uid} via serviceSyndicAgentUids/geranceLocativeAgentUids
// (resolveUsersByUids, cf. lib/users.ts). Pas de état intermédiaire "pas
// encore invité" à représenter ici : inviter EST l'action qui le crée.
export type AgencyDept = {
  mail: string
  phone: string
  // Compte BO lié à l'adresse GÉNÉRIQUE du service (cas "une adresse
  // globale par service", sans agent nommé individuel) - posé par
  // inviteAgencyAccount, jamais saisi à la main.
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
  // Identité légale de la société (pas d'un compte individuel) - un compte
  // agence n'a pas de "nom/prénom" personnel qui ait du sens sur son profil,
  // c'est le responsable légal de l'agence qui est pertinent. Peut être
  // rempli à la main ou via recherche-entreprises.api.gouv.fr (SIRET/SIREN).
  siret?: string
  responsableLegal?: string
}

export const emptyAgencyDept: AgencyDept = {
  mail: "",
  phone: "",
}

// Champ gerance.<x> à ArrayUnion/ArrayRemove selon le service - partagé
// entre AgencesPage (invite/révoque) et ResidenceDetailPage (choix de
// l'agent responsable d'une résidence, résolu depuis ce même tableau).
export const AGENT_UID_FIELD: Record<ServiceType, "serviceSyndicAgentUids" | "geranceLocativeAgentUids"> = {
  serviceSyndic: "serviceSyndicAgentUids",
  geranceLocative: "geranceLocativeAgentUids",
}
