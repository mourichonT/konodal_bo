import { appBaseUrl } from "@/lib/utils"
import {
  addDoc,
  collection,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { db, functions } from "@/firebase"
import { emptyAddress, type Address } from "@/types/residence"
import { emptyAgencyDept, type AgencyDept, type Gerance, type ServiceType } from "@/types/gerance"
import type { CompanySearchResult } from "@/lib/companySearch"

const gerancesCollection = collection(db, "gerances")

// Merge superficiel volontaire pour name/address/services - chaque dept est
// renormalisé individuellement contre emptyAgencyDept (mail/phone toujours
// définis, même sur un document plus ancien créé avant l'ajout d'un champ).
function toGerance(id: string, data: unknown): Gerance {
  const raw = (data as Partial<Omit<Gerance, "id">>) ?? {}
  const rawServices = raw.services ?? {}
  const services: Partial<Record<ServiceType, AgencyDept>> = {}
  for (const type of Object.keys(rawServices) as ServiceType[]) {
    const dept = rawServices[type]
    if (!dept) continue
    services[type] = { ...emptyAgencyDept, ...dept }
  }
  return {
    id,
    name: "",
    address: emptyAddress,
    ...raw,
    services,
  }
}

export function subscribeToGerances(
  onData: (gerances: Gerance[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(gerancesCollection, orderBy("name"))
  return onSnapshot(
    q,
    (snapshot) => onData(snapshot.docs.map((d) => toGerance(d.id, d.data()))),
    onError
  )
}

export function subscribeToGerance(
  id: string,
  onData: (gerance: Gerance | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(gerancesCollection, id),
    (snapshot) => onData(snapshot.exists() ? toGerance(snapshot.id, snapshot.data()) : null),
    onError
  )
}

export type GeranceInput = {
  name: string
  address: Address
  services: Partial<Record<ServiceType, AgencyDept>>
  // Optionnels dès la création (pas seulement via updateGeranceLegalInfo/
  // applyCompanySearchResult sur une fiche déjà existante) - remplis à la
  // main ou via recherche-entreprises.api.gouv.fr dans GeranceFormDialog.
  siret?: string
  responsableLegal?: string
}

// `uid` (posé par inviteAgencyAccount) est préservé tel quel s'il existe
// déjà - jamais saisi manuellement dans le formulaire agence, donc jamais
// réécrit par lui.
function sanitizeServices(
  services: Partial<Record<ServiceType, AgencyDept>>
): Partial<Record<ServiceType, AgencyDept>> {
  const result: Partial<Record<ServiceType, AgencyDept>> = {}
  for (const [key, dept] of Object.entries(services) as [ServiceType, AgencyDept][]) {
    result[key] = {
      mail: dept.mail,
      phone: dept.phone,
      ...(dept.uid ? { uid: dept.uid } : {}),
    }
  }
  return result
}

export async function createGerance(input: GeranceInput) {
  await addDoc(gerancesCollection, {
    name: input.name,
    address: input.address,
    services: sanitizeServices(input.services),
    siret: input.siret ?? "",
    responsableLegal: input.responsableLegal ?? "",
  })
}

export async function updateGerance(id: string, input: GeranceInput) {
  await updateDoc(doc(db, "gerances", id), {
    name: input.name,
    address: input.address,
    services: sanitizeServices(input.services),
    siret: input.siret ?? "",
    responsableLegal: input.responsableLegal ?? "",
  })
}

// Édition ciblée de l'adresse seule, exposée en champs directement
// modifiables sur la fiche Agence (OwnAgencyPage) - pas de dialog/bouton
// "Modifier" pour ce champ précis (celui-ci reste réservé à
// Services/Agents, plus complexes) : demande explicite de l'utilisateur.
export async function updateGeranceAddress(id: string, address: Address) {
  await updateDoc(doc(db, "gerances", id), { address })
}

// Édition ciblée du nom affiché seul, même exposition directe qu'
// updateGeranceAddress sur OwnAgencyPage (GeranceFormDialog reste réservé au
// répertoire Superadmin, il expose aussi l'activation/désactivation des
// services et la révocation de comptes - hors de portée d'une simple Agence
// éditant sa propre fiche).
export async function updateGeranceName(id: string, name: string) {
  await updateDoc(doc(db, "gerances", id), { name })
}

// Édition manuelle du SIRET/responsable légal, sans passer par la
// recherche - un utilisateur peut vouloir corriger le résultat auto ou le
// saisir directement.
export async function updateGeranceLegalInfo(
  id: string,
  info: { siret: string; responsableLegal: string }
) {
  await updateDoc(doc(db, "gerances", id), info)
}

// Reporte un résultat de recherche-entreprises.api.gouv.fr (cf.
// lib/companySearch.ts) directement sur la fiche - écrase nom/adresse en
// plus de siret/responsableLegal, l'utilisateur ayant explicitement choisi
// ce résultat pour représenter son agence.
export async function applyCompanySearchResult(id: string, result: CompanySearchResult) {
  await updateDoc(doc(db, "gerances", id), {
    name: result.name,
    address: result.address,
    siret: result.siret,
    responsableLegal: result.responsableLegal,
  })
}

export type AgencyAccountRole = "agence" | "agent"

// Cloud Functions Admin SDK (functions_python/main.py) - seul chemin pour
// créer/lier un compte agence/agent : firestore.rules interdit d'écrire
// gerances/{id}.serviceSyndicAgentUids/geranceLocativeAgentUids directement
// depuis le client, même pour une Agence éditant sa propre fiche (cf.
// commentaire sur la règle) - évite qu'un compte compromis s'auto-octroie
// l'accès à d'autres résidences.
// pending: true (aucun `uid`) - la gérance n'a pas encore d'abonnement actif
// et ce n'est pas une réactivation : le compte n'est PAS créé maintenant,
// seul un email commercial (page d'offre publique) part à cette adresse.
// L'activation réelle n'a lieu qu'à la confirmation du paiement Stripe (côté
// serveur, cf. commentaire sur invite_agency_account) - pending: false quand
// le compte a été activé immédiatement (siège déjà couvert).
// licenceAdded : licence ajoutée à l'abonnement par cette invitation (aucune
// si une licence disponible a été prise).
export type InviteAgencyAccountResult =
  | { uid: string; pending: false; licenceAdded: "service" | "agent" | null }
  | { pending: true }

export async function inviteAgencyAccount(
  geranceId: string,
  serviceType: ServiceType,
  email: string,
  role: AgencyAccountRole
): Promise<InviteAgencyAccountResult> {
  const call = httpsCallable<
    { geranceId: string; serviceType: ServiceType; email: string; role: AgencyAccountRole; origin: string },
    InviteAgencyAccountResult
  >(functions, "invite_agency_account")
  // origin (appBaseUrl()) : même convention que createCheckoutSession
  // (lib/billing.ts) - sert à invite_agency_account à construire le lien de la
  // page d'offre publique (/offre/:token) sans domaine codé en dur côté serveur.
  const result = await call({ geranceId, serviceType, email, role, origin: appBaseUrl() })
  return result.data
}

// Révocation (revoke_agency_account) : la licence du compte est libérée (elle
// reste achetée et disponible, seul « Retirer » réduit l'abonnement),
// l'adresse du service est libérée, et le compte supprimé - sauf s'il sert
// encore ailleurs (agent d'une autre gérance, compte résident) :
// accountDeleted indique lequel des deux.
export async function revokeAgencyAccount(
  geranceId: string,
  serviceType: ServiceType,
  uid: string
): Promise<{ accountDeleted: boolean }> {
  const call = httpsCallable<
    { geranceId: string; serviceType: ServiceType; uid: string },
    { success: boolean; accountDeleted?: boolean }
  >(functions, "revoke_agency_account")
  const { data } = await call({ geranceId, serviceType, uid })
  return { accountDeleted: !!data.accountDeleted }
}

// Équipe de l'agence (get_agency_team) : adresse et dernière connexion de
// chaque compte, lues dans Firebase Auth. Jamais connecté = invitation pas
// encore acceptée.
export type AgencyTeamMember = {
  uid: string
  email: string | null
  createdAt: Date | null
  lastSignInAt: Date | null
}

export async function getAgencyTeam(geranceId: string): Promise<Record<string, AgencyTeamMember>> {
  const call = httpsCallable<
    { geranceId: string },
    { members: { uid: string; email: string | null; createdAt: number | null; lastSignInAt: number | null }[] }
  >(functions, "get_agency_team")
  const { data } = await call({ geranceId })
  return Object.fromEntries(
    data.members.map((m) => [
      m.uid,
      {
        uid: m.uid,
        email: m.email,
        createdAt: m.createdAt ? new Date(m.createdAt) : null,
        lastSignInAt: m.lastSignInAt ? new Date(m.lastSignInAt) : null,
      },
    ])
  )
}

// Nouvel email d'invitation (lien de mot de passe) à un compte jamais connecté.
export async function resendAgencyInvite(geranceId: string, uid: string): Promise<void> {
  const call = httpsCallable<{ geranceId: string; uid: string }, { success: boolean }>(
    functions,
    "resend_agency_invite"
  )
  await call({ geranceId, uid })
}

// « Libérer la licence » (licensed: false) : l'agent reste dans l'équipe sans
// aucun accès. « Attribuer une licence » (true) : licence disponible, sinon
// une de plus au prorata (licenceAdded). licence_billing.set_agent_licence.
export async function setAgentLicence(
  geranceId: string,
  uid: string,
  licensed: boolean
): Promise<{ licenceAdded: boolean }> {
  const call = httpsCallable<
    { geranceId: string; uid: string; licensed: boolean; requestId: string },
    { licensed: boolean; licenceAdded?: boolean }
  >(functions, "set_agent_licence")
  const { data } = await call({ geranceId, uid, licensed, requestId: crypto.randomUUID() })
  return { licenceAdded: !!data.licenceAdded }
}

// Bilan renvoyé par admin_delete_gerance (functions_python/main.py) : en
// dryRun, sert à la fenêtre de confirmation. attachedResidences non vide =
// suppression refusée (résidence, bâtiment ou lot encore rattaché).
export type GeranceDeletionSummary = {
  name: string
  attachedResidences: { id: string; name: string; residence: boolean; structures: number; lots: number }[]
  accountsDeleted: number
  accountsKept: number
  contacts: number
  pendingInvitations: number
  subscriptionStatus: string | null
  subscriptionActive: boolean
  deleted?: boolean
}

// Suppression complète d'une agence (superAdmin) : abonnement Stripe résilié
// immédiatement, comptes agence/agents supprimés comme à la révocation (sauf
// s'ils servent ailleurs), contacts et invitations nettoyés, puis gerances/{id}
// et ses sous-collections. Côté serveur (Admin SDK, Stripe). Refusée tant
// qu'une résidence, un bâtiment ou un lot pointe vers l'agence, et si
// confirmName n'est pas exactement son nom.
export async function deleteGerance(
  geranceId: string,
  options: { dryRun: true } | { confirmName: string }
): Promise<GeranceDeletionSummary> {
  const call = httpsCallable<
    { geranceId: string; dryRun?: boolean; confirmName?: string },
    GeranceDeletionSummary
  >(functions, "admin_delete_gerance", { timeout: 300_000 })
  return (await call({ geranceId, ...options })).data
}

export const REVOKE_CONFIRM_MESSAGE =
  "Révoquer cet accès supprime le compte définitivement (sauf s'il sert ailleurs). Sa licence redevient disponible pour un autre compte et reste facturée tant qu'elle n'est pas retirée (carte Abonnement). Continuer ?"

export function revokeSuccessMessage({ accountDeleted }: { accountDeleted: boolean }): string {
  return accountDeleted
    ? "Accès révoqué et compte supprimé : la licence est disponible"
    : "Accès révoqué (compte conservé, utilisé ailleurs) : la licence est disponible"
}

// Compte BO lié à l'adresse générique du service (pas d'agent nommé - cas
// "une adresse globale par service"). Un agent NOMMÉ, lui, n'a plus besoin
// d'équivalent : sa présence dans serviceSyndicAgentUids/
// geranceLocativeAgentUids (posée directement par invite_agency_account)
// suffit à le faire apparaître, résolu via resolveUsersByUids.
export async function setDeptAccountUid(gerance: Gerance, serviceType: ServiceType, uid: string) {
  await updateDoc(doc(db, "gerances", gerance.id), {
    [`services.${serviceType}.uid`]: uid,
  })
}

// Édition ciblée du contact d'un service (mail/téléphone), même logique que
// updateGeranceAddress - fiche Agence directement modifiable, sans dialog.
// « Réponses dans l'application » (page Messages) : réglage de l'agence,
// écrit directement par le compte agence (firestore.rules l'autorise sur sa
// fiche) ou un superAdmin ; reply_to_resident_mail le revérifie.
export async function setInAppReplies(geranceId: string, enabled: boolean, uid: string) {
  await updateDoc(doc(db, "gerances", geranceId), {
    inAppReplies: { enabled, updatedBy: uid, updatedAt: serverTimestamp() },
  })
}

// Rattachement contact <-> gérance (annuaire Superadmin uniquement, cf.
// Gerance.contactRefs) - même pattern qu'un toggle = une écriture ciblée que
// setContactResidenceLink (lib/contacts.ts), pas un set complet d'un tableau.
export async function setContactGeranceLink(geranceId: string, contactId: string, linked: boolean) {
  await updateDoc(doc(gerancesCollection, geranceId), {
    [`contactRefs.${contactId}`]: linked ? true : deleteField(),
  })
}

export async function updateGeranceDeptContact(
  id: string,
  serviceType: ServiceType,
  contact: { mail: string; phone: string }
) {
  await updateDoc(doc(db, "gerances", id), {
    [`services.${serviceType}.mail`]: contact.mail,
    [`services.${serviceType}.phone`]: contact.phone,
  })
}
