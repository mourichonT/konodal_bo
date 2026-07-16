import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore"
import { db } from "@/firebase"
import type { Sinistre, SinistreStatus } from "@/types/sinistre"

function toDateOrNull(value: unknown): Date | null {
  return value && typeof (value as { toDate?: unknown }).toDate === "function"
    ? (value as { toDate: () => Date }).toDate()
    : null
}

function toSinistre(residenceId: string, d: DocumentSnapshot<DocumentData>): Sinistre {
  const data = d.data() ?? {}
  const location = (data.location as Record<string, unknown>) ?? data
  return {
    id: d.id,
    residenceId,
    title: (data.title as string) ?? "",
    description: (data.description as string) ?? "",
    statut: (data.statut as string) ?? "Non envoyé",
    pathImage: (data.pathImage as string) ?? "",
    isVideo: (data.isVideo as boolean) ?? false,
    locationElement: (location.locationElements as string) ?? "",
    locationFloor: (location.locationFloor as string) ?? "",
    timeStamp: toDateOrNull(data.timeStamp),
    declaredDate: toDateOrNull(data.declaredDate),
    user: (data.user as string) ?? "",
  }
}

// residences/{id}/posts, filtré type == "sinistres" : pas de collectionGroup
// disponible (aucune règle/index dédiés côté connectkasa, comme pour
// users/*/lots) - le board agrège résidence par résidence plutôt qu'une
// requête globale, cf. mémoire projet sur ce choix.
export function subscribeToResidenceSinistres(
  residenceId: string,
  onData: (sinistres: Sinistre[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(collection(db, "residences", residenceId, "posts"), where("type", "==", "sinistres"))
  return onSnapshot(
    q,
    (snapshot) => onData(snapshot.docs.map((d) => toSinistre(residenceId, d))),
    onError
  )
}

export function subscribeToSinistre(
  residenceId: string,
  postId: string,
  onData: (sinistre: Sinistre | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "residences", residenceId, "posts", postId),
    (snapshot) => onData(snapshot.exists() ? toSinistre(residenceId, snapshot) : null),
    onError
  )
}

// Réservé isCsMember/isSuperAdmin côté firestore.rules (posts/{id}.update).
export async function updateSinistreStatut(
  residenceId: string,
  postId: string,
  statut: SinistreStatus
) {
  await updateDoc(doc(db, "residences", residenceId, "posts", postId), { statut })
}

export async function deleteSinistre(residenceId: string, postId: string) {
  await deleteDoc(doc(db, "residences", residenceId, "posts", postId))
}

// posts/{id}/signalements : déclarations associées/doublons détectés pour un
// même sinistre (cf. mémoire scope-vision) - chargé à la demande seulement
// (page détail), jamais pour l'affichage en liste/carte.
export function subscribeToSinistreSignalements(
  residenceId: string,
  postId: string,
  onData: (signalements: Sinistre[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, "residences", residenceId, "posts", postId, "signalements"),
    (snapshot) => onData(snapshot.docs.map((d) => toSinistre(residenceId, d))),
    onError
  )
}
