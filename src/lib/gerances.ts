import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { db, functions } from "@/firebase"
import { emptyAddress, type Address } from "@/types/residence"
import { emptyAgencyDept, type AgencyDept, type Gerance, type ServiceType } from "@/types/gerance"

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
  })
}

export async function updateGerance(id: string, input: GeranceInput) {
  await updateDoc(doc(db, "gerances", id), {
    name: input.name,
    address: input.address,
    services: sanitizeServices(input.services),
  })
}

// Édition ciblée de l'adresse seule, exposée en champs directement
// modifiables sur la fiche Agence (OwnAgencyPage) - pas de dialog/bouton
// "Modifier" pour ce champ précis (celui-ci reste réservé à
// Services/Agents, plus complexes) : demande explicite de l'utilisateur.
export async function updateGeranceAddress(id: string, address: Address) {
  await updateDoc(doc(db, "gerances", id), { address })
}

export type AgencyAccountRole = "agence" | "agent"

// Cloud Functions Admin SDK (functions_python/main.py) - seul chemin pour
// créer/lier un compte agence/agent : firestore.rules interdit d'écrire
// gerances/{id}.serviceSyndicAgentUids/geranceLocativeAgentUids directement
// depuis le client, même pour une Agence éditant sa propre fiche (cf.
// commentaire sur la règle) - évite qu'un compte compromis s'auto-octroie
// l'accès à d'autres résidences.
export async function inviteAgencyAccount(
  geranceId: string,
  serviceType: ServiceType,
  email: string,
  role: AgencyAccountRole
): Promise<{ uid: string }> {
  const call = httpsCallable<
    { geranceId: string; serviceType: ServiceType; email: string; role: AgencyAccountRole },
    { uid: string }
  >(functions, "invite_agency_account")
  const result = await call({ geranceId, serviceType, email, role })
  return result.data
}

export async function revokeAgencyAccount(
  geranceId: string,
  serviceType: ServiceType,
  uid: string
): Promise<void> {
  const call = httpsCallable<{ geranceId: string; serviceType: ServiceType; uid: string }, { success: boolean }>(
    functions,
    "revoke_agency_account"
  )
  await call({ geranceId, serviceType, uid })
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
