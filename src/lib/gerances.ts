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
import { db } from "@/firebase"
import { emptyAddress, type Address } from "@/types/residence"
import type { AgencyDept, Gerance, ServiceType } from "@/types/gerance"

const gerancesCollection = collection(db, "gerances")

export function subscribeToGerances(
  onData: (gerances: Gerance[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(gerancesCollection, orderBy("name"))
  return onSnapshot(
    q,
    (snapshot) => {
      onData(
        snapshot.docs.map((d) => ({
          id: d.id,
          name: "",
          address: emptyAddress,
          services: {},
          ...(d.data() as Partial<Omit<Gerance, "id">>),
        }))
      )
    },
    onError
  )
}

export type GeranceInput = {
  name: string
  address: Address
  services: Partial<Record<ServiceType, AgencyDept>>
}

// Les agents n'ont pas forcément de mail/téléphone direct (contact au niveau
// du service uniquement) : on omet ces clés plutôt que d'écrire une chaîne
// vide, pour rester compatible avec le modèle Agent côté app mobile
// (mail/phone optionnels, absents si non renseignés).
function sanitizeServices(
  services: Partial<Record<ServiceType, AgencyDept>>
): Partial<Record<ServiceType, AgencyDept>> {
  const result: Partial<Record<ServiceType, AgencyDept>> = {}
  for (const [key, dept] of Object.entries(services) as [ServiceType, AgencyDept][]) {
    result[key] = {
      mail: dept.mail,
      phone: dept.phone,
      agents: dept.agents.map((agent) => ({
        name_agent: agent.name_agent,
        surname_agent: agent.surname_agent,
        ...(agent.mail ? { mail: agent.mail } : {}),
        ...(agent.phone ? { phone: agent.phone } : {}),
      })),
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
