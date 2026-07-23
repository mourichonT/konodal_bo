import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore"
import { db } from "@/firebase"
import type { Lot } from "@/types/lot"

function lotsCollection(residenceId: string) {
  return collection(db, "residences", residenceId, "lots")
}

// Pas de orderBy("order") côté Firestore à dessein - même piège que
// subscribeToStructures/subscribeToUsers (exclusion silencieuse des
// documents sans le champ). Tri côté client, ceux sans `order` passent
// après (Infinity).
export function subscribeToLots(
  residenceId: string,
  onData: (lots: Lot[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(lotsCollection(residenceId))
  return onSnapshot(
    q,
    (snapshot) => {
      const lots = snapshot.docs.map((d) => ({
        id: d.id,
        refLot: "",
        batiment: "",
        lot: "",
        typeLot: "",
        isLinkable: false,
        idProprietaire: [],
        idLocataire: [],
        ...(d.data() as Partial<Omit<Lot, "id">>),
      }))
      lots.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
      onData(lots)
    },
    onError
  )
}

export type LotInput = {
  refLot: string
  batiment: string
  lot: string
  typeLot: string
  isLinkable: boolean
  order: number
}

// Mêmes clés que Lot.toJsonForDb() côté app mobile (connectkasa) : on
// n'écrit que les champs gérés depuis cet écran, jamais idLocataire,
// syndicAgency, parentLotId... pour ne pas écraser des données gérées
// ailleurs (attribution de lot, rattachement parent-enfant).
function toFirestoreLotData(input: LotInput) {
  return {
    ...(input.refLot ? { refLot: input.refLot } : {}),
    ...(input.batiment ? { batiment: input.batiment } : {}),
    ...(input.lot ? { lot: input.lot } : {}),
    ...(input.typeLot ? { typeLot: input.typeLot } : {}),
    isLinkable: input.isLinkable,
    order: input.order,
  }
}

// Nouveau lot : ID auto-généré, reporté dans le champ `id` du document lui
// même (convention Lot.id côté app mobile).
export async function createLot(residenceId: string, input: LotInput) {
  const ref = doc(lotsCollection(residenceId))
  await setDoc(ref, { ...toFirestoreLotData(input), id: ref.id, idProprietaire: [] })
}

export async function updateLot(residenceId: string, id: string, input: LotInput) {
  await setDoc(doc(db, "residences", residenceId, "lots", id), toFirestoreLotData(input), {
    merge: true,
  })
}

export async function deleteLot(residenceId: string, id: string) {
  await deleteDoc(doc(db, "residences", residenceId, "lots", id))
}
