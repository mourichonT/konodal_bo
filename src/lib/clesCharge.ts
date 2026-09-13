import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore"
import { db } from "@/firebase"
import type { ClefCharge } from "@/types/clefCharge"

function clesChargeCollection(residenceId: string) {
  return collection(db, "residences", residenceId, "clesCharge")
}

// Tri alphabétique par nom - pas de champ `order` dans ce modèle côté app
// mobile (ClefCharge.toMap), contrairement aux lots/structures.
export function subscribeToClesCharge(
  residenceId: string,
  onData: (clesCharge: ClefCharge[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    clesChargeCollection(residenceId),
    (snapshot) => {
      const clesCharge = snapshot.docs.map((d) => ({
        residenceId,
        nom: "",
        tantiemesParLot: {},
        ...(d.data() as Partial<Omit<ClefCharge, "id">>),
        id: d.id,
      }))
      clesCharge.sort((a, b) => a.nom.localeCompare(b.nom))
      onData(clesCharge)
    },
    onError
  )
}

// Mêmes clés que ClefCharge.toMap() côté app mobile : residenceId, nom,
// tantiemesParLot. `tantiemesParLot` vide à la création, rempli lot par lot
// ensuite (cf. setLotTantiemeForClef).
export async function createClefCharge(residenceId: string, nom: string): Promise<string> {
  const ref = await addDoc(clesChargeCollection(residenceId), {
    residenceId,
    nom,
    tantiemesParLot: {},
  })
  return ref.id
}

export async function updateClefChargeNom(residenceId: string, id: string, nom: string) {
  await updateDoc(doc(db, "residences", residenceId, "clesCharge", id), { nom })
}

export async function deleteClefCharge(residenceId: string, id: string) {
  await deleteDoc(doc(db, "residences", residenceId, "clesCharge", id))
}

// Écriture surgicale d'un seul lot dans tantiemesParLot via un chemin de
// champ à points - jamais un set() de la map entière depuis ce BO, pour ne
// pas écraser les valeurs des autres lots si deux personnes éditent la même
// clé pour deux lots différents en même temps (contrairement à
// ManageClesChargeConfiguration côté app mobile, qui recharge/réécrit la map
// complète - safe là-bas car un seul écran l'édite à la fois).
export async function setLotTantiemeForClef(
  residenceId: string,
  clefId: string,
  lotId: string,
  value: number
) {
  await updateDoc(doc(db, "residences", residenceId, "clesCharge", clefId), {
    [`tantiemesParLot.${lotId}`]: value,
  })
}
