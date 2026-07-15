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
import type { Address, Residence } from "@/types/residence"

const residencesCollection = collection(db, "residences")

export function subscribeToResidences(
  onData: (residences: Residence[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(residencesCollection, orderBy("name"))
  return onSnapshot(
    q,
    (snapshot) => {
      onData(
        snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Residence, "id">) }))
      )
    },
    onError
  )
}

export type ResidenceInput = {
  name: string
  address: Address
  mail_contact?: string
}

export async function createResidence(input: ResidenceInput) {
  await addDoc(residencesCollection, {
    ...input,
    totalLot: 0,
  })
}

export async function updateResidence(id: string, input: ResidenceInput) {
  await updateDoc(doc(db, "residences", id), { ...input })
}
