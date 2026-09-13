import { doc, onSnapshot, setDoc, updateDoc, type Unsubscribe } from "firebase/firestore"
import { db } from "@/firebase"
import type { AccessPoint } from "@/types/accessPoint"

// Point d'accès de la résidence (portail) - resides/{id}/access/main, à part
// du document résidence lui-même (lecture plus restreinte, cf.
// firestore.rules) - même chemin que côté app mobile
// (firestore_residence_repository.dart:getResidenceAccessPoint/
// saveResidenceAccessPoint).
function residenceAccessDoc(residenceId: string) {
  return doc(db, "residences", residenceId, "access", "main")
}

export function subscribeToResidenceAccessPoint(
  residenceId: string,
  onData: (accessPoint: AccessPoint | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    residenceAccessDoc(residenceId),
    (snap) => onData(snap.exists() ? (snap.data() as AccessPoint) : null),
    onError
  )
}

export async function saveResidenceAccessPoint(residenceId: string, accessPoint: AccessPoint) {
  await setDoc(residenceAccessDoc(residenceId), accessPoint)
}

// Écriture surgicale du seul champ accessPoint d'un bâtiment - jamais via
// updateStructure/StructureInput (lib/structures.ts), pour ne pas avoir à
// faire transiter ce champ par le formulaire "Structures / bâtiments".
export async function setStructureAccessPoint(
  residenceId: string,
  structureId: string,
  accessPoint: AccessPoint
) {
  await updateDoc(doc(db, "residences", residenceId, "structures", structureId), { accessPoint })
}
