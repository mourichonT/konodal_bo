import {
  addDoc,
  collection,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore"
import { db } from "@/firebase"
import type { Address, GeranceRef, Residence } from "@/types/residence"

const residencesCollection = collection(db, "residences")

export function subscribeToResidences(
  onData: (residences: Residence[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(residencesCollection, orderBy("name"))
  return onSnapshot(
    q,
    (snapshot) => {
      // `id` posé après le spread : même précaution que subscribeToLots
      // (lib/lots.ts) - un champ `id` stocké dans le document divergent du
      // vrai id Firestore écraserait sinon silencieusement la valeur fiable.
      onData(
        snapshot.docs.map((d) => ({ ...(d.data() as Omit<Residence, "id">), id: d.id }))
      )
    },
    onError
  )
}

export function subscribeToResidence(
  id: string,
  onData: (residence: Residence | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(residencesCollection, id),
    (snapshot) => {
      onData(
        snapshot.exists() ? { ...(snapshot.data() as Omit<Residence, "id">), id: snapshot.id } : null
      )
    },
    onError
  )
}

// Périmètre d'un compte agence/agent (RBAC) : résidences dont geranceRef
// pointe vers CETTE gérance - requête indexée directe plutôt qu'un champ
// dénormalisé gerance.residenceIds (évite une double écriture à maintenir
// à chaque réassignation de gérance sur une résidence, cf. discussion de
// cadrage RBAC). isProfessionnelResidence côté firestore.rules vérifie la
// même relation, dans l'autre sens, résidence par résidence.
export function subscribeToResidencesForGerance(
  geranceId: string,
  onData: (residences: Residence[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(residencesCollection, where("geranceRef.geranceId", "==", geranceId))
  return onSnapshot(
    q,
    (snapshot) =>
      onData(snapshot.docs.map((d) => ({ ...(d.data() as Omit<Residence, "id">), id: d.id }))),
    onError
  )
}

export type ResidenceInput = {
  name: string
  address: Address
  mail_contact?: string
}

// geranceRef : requis côté règle Firestore pour qu'une Agence (pas un
// simple Agent) crée sa propre résidence - isProfessionnelResidence()
// dépend de ce champ, une résidence créée sans lui resterait invisible/
// non modifiable ensuite pour son créateur (ni CS member, ni Super Admin,
// ni Professionnel tant que geranceRef est absent). Absent pour une
// création Super Admin (assignation de gérance faite séparément depuis la
// fiche résidence, cf. updateResidenceGeranceRef).
export async function createResidence(input: ResidenceInput, geranceRef?: GeranceRef) {
  await addDoc(residencesCollection, {
    ...input,
    totalLot: 0,
    ...(geranceRef ? { geranceRef } : {}),
  })
}

export async function updateResidence(id: string, input: ResidenceInput) {
  await updateDoc(doc(db, "residences", id), { ...input })
}

export async function updateResidenceGeo(id: string, lat: number, lng: number) {
  await updateDoc(doc(db, "residences", id), { lat, lng })
}

// Rattache/détache la gérance qui gère cette résidence - condition
// nécessaire pour qu'un compte agence/agent (RBAC) voie quoi que ce soit
// (isProfessionnelResidence/isProfessionnelLot côté firestore.rules lisent
// ce champ). deleteField() plutôt que null : la règle teste
// 'geranceRef' in residence, qui resterait vraie avec une valeur null et
// ferait échouer l'accès à .serviceType ensuite.
export async function updateResidenceGeranceRef(id: string, geranceRef: GeranceRef | null) {
  await updateDoc(doc(db, "residences", id), {
    geranceRef: geranceRef ?? deleteField(),
  })
}
