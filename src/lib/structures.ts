import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore"
import { db } from "@/firebase"
import type { StructureResidence } from "@/types/structure"

function structuresCollection(residenceId: string) {
  return collection(db, "residences", residenceId, "structures")
}

export function subscribeToStructures(
  residenceId: string,
  onData: (structures: StructureResidence[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(structuresCollection(residenceId), orderBy("name"))
  return onSnapshot(
    q,
    (snapshot) => {
      onData(
        snapshot.docs.map((d) => ({
          id: d.id,
          name: "",
          type: "",
          etage: [],
          hasUnderground: false,
          ...(d.data() as Partial<Omit<StructureResidence, "id">>),
        }))
      )
    },
    onError
  )
}

export type StructureInput = {
  name: string
  type: string
  etage: string[]
  hasUnderground: boolean
}

export async function createStructure(residenceId: string, input: StructureInput) {
  await addDoc(structuresCollection(residenceId), {
    ...input,
    // Champs présents côté app mobile (StructureResidence.toJson) mais pas
    // encore gérés depuis ce formulaire ; explicitement null plutôt
    // qu'absents pour matcher le shape attendu par l'app.
    elements: null,
    hasDifferentSyndic: false,
    syndicAgency: null,
    geranceRef: null,
  })
}

export async function updateStructure(
  residenceId: string,
  id: string,
  input: StructureInput
) {
  await updateDoc(doc(db, "residences", residenceId, "structures", id), { ...input })
}

export async function deleteStructure(residenceId: string, id: string) {
  await deleteDoc(doc(db, "residences", residenceId, "structures", id))
}
