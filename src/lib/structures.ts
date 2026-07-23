import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore"
import { db } from "@/firebase"
import type { StructureResidence } from "@/types/structure"

function structuresCollection(residenceId: string) {
  return collection(db, "residences", residenceId, "structures")
}

// Pas de orderBy("order") côté Firestore à dessein : les structures créées
// avant l'ajout de ce champ n'en ont pas, et Firestore exclurait
// silencieusement ces documents d'un orderBy dessus (même piège que
// subscribeToUsers/createdDate). Tri fait côté client, celles sans `order`
// passent après (Infinity), en conservant l'ordre alphabétique entre elles.
export function subscribeToStructures(
  residenceId: string,
  onData: (structures: StructureResidence[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    structuresCollection(residenceId),
    (snapshot) => {
      const structures = snapshot.docs.map((d) => ({
        id: d.id,
        name: "",
        type: "",
        etage: [],
        hasUnderground: false,
        ...(d.data() as Partial<Omit<StructureResidence, "id">>),
      }))
      structures.sort((a, b) => {
        const orderDiff = (a.order ?? Infinity) - (b.order ?? Infinity)
        return orderDiff !== 0 ? orderDiff : a.name.localeCompare(b.name)
      })
      onData(structures)
    },
    onError
  )
}

export type StructureInput = {
  name: string
  type: string
  etage: string[]
  hasUnderground: boolean
  elements: string[]
}

// `order` fourni par l'appelant (pas dans StructureInput, réutilisé aussi
// pour l'édition où l'ordre ne change jamais depuis ce formulaire) - une
// nouvelle structure prend place à la fin de la liste actuelle.
export async function createStructure(residenceId: string, input: StructureInput, order: number) {
  await addDoc(structuresCollection(residenceId), {
    ...input,
    order,
    // Champs présents côté app mobile (StructureResidence.toJson) mais pas
    // encore gérés depuis ce formulaire ; explicitement null plutôt
    // qu'absents pour matcher le shape attendu par l'app.
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

// Réorganisation click-and-déplace (StructuresSection) - `orderedIds` reflète
// le nouvel ordre visuel complet, chaque structure reçoit son index comme
// `order`.
export async function reorderStructures(residenceId: string, orderedIds: string[]) {
  const batch = writeBatch(db)
  orderedIds.forEach((id, index) => {
    batch.update(doc(db, "residences", residenceId, "structures", id), { order: index })
  })
  await batch.commit()
}

export async function deleteStructure(residenceId: string, id: string) {
  await deleteDoc(doc(db, "residences", residenceId, "structures", id))
}
