import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore"
import { db } from "@/firebase"
import type { Sinistre, SinistrePriority, SinistreStatus } from "@/types/sinistre"

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
    priority: (data.priority as SinistrePriority) ?? "normale",
    pathImage: (data.pathImage as string) ?? "",
    isVideo: (data.isVideo as boolean) ?? false,
    locationElement: (location.locationElements as string) ?? "",
    locationFloor: (location.locationFloor as string) ?? "",
    timeStamp: toDateOrNull(data.timeStamp),
    declaredDate: toDateOrNull(data.declaredDate),
    dateClosed: toDateOrNull(data.dateClosed),
    archived: (data.archived as boolean) ?? false,
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
// dateClosed : écrit uniquement à la transition vers "Terminé" (même
// convention que côté app, icon_modify_or_delette.dart), jamais modélisé
// ailleurs pour ne pas risquer de l'effacer sur un autre changement.
export async function updateSinistreStatut(
  residenceId: string,
  postId: string,
  statut: SinistreStatus
) {
  await updateDoc(doc(db, "residences", residenceId, "posts", postId), {
    statut,
    ...(statut === "Terminé" ? { dateClosed: serverTimestamp() } : {}),
  })
}

// Champ backoffice uniquement (cf. commentaire sur SinistrePriority) - update()
// partiel, comme updateSinistreStatut.
export async function updateSinistrePriority(
  residenceId: string,
  postId: string,
  priority: SinistrePriority
) {
  await updateDoc(doc(db, "residences", residenceId, "posts", postId), { priority })
}

// Champ backoffice uniquement (cf. commentaire dans types/sinistre.ts) -
// n'affecte jamais `statut`, juste la visibilité dans le Kanban.
export async function updateSinistreArchived(
  residenceId: string,
  postId: string,
  archived: boolean
) {
  await updateDoc(doc(db, "residences", residenceId, "posts", postId), { archived })
}

export async function deleteSinistre(residenceId: string, postId: string) {
  await deleteDoc(doc(db, "residences", residenceId, "posts", postId))
}

// Cloud Function existante (functions_python/main.py:generate_report), déjà
// utilisée côté app mobile (exportpdfhttp.dart:fetchPostPdf) pour le même
// rapport - CORS ouvert en POST, aucune auth requise, réutilisée telle
// quelle plutôt que de dupliquer la génération PDF côté BO.
const GENERATE_REPORT_URL = "https://us-central1-konodal-dev.cloudfunctions.net/generate_report"

export async function fetchSinistreReportPdf(residenceId: string, postId: string): Promise<Blob> {
  const response = await fetch(GENERATE_REPORT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId, residenceId }),
  })
  if (!response.ok) {
    throw new Error(`Le serveur a répondu ${response.status}`)
  }
  return response.blob()
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
