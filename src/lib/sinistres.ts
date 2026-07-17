import {
  collection,
  deleteDoc,
  deleteField,
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

// Les champs date (creationDate/declaredDate/closedDate) vivent sous une
// sous-clé `dates` côté app (Post.toMap()/fromMap(),
// konodal_app/lib/models/pages_models/post.dart), sous ces noms depuis
// migrate_post_dates_rename.py (anciennement timeStamp/dateClosed - fallback
// conservé pour les documents pas encore repris). inProgressDate n'a jamais
// existé sous un autre nom (champ backoffice ajouté directement au nouveau
// format), pas de fallback nécessaire pour lui.
function toSinistre(residenceId: string, d: DocumentSnapshot<DocumentData>): Sinistre {
  const data = d.data() ?? {}
  const location = (data.location as Record<string, unknown>) ?? data
  const dates = (data.dates as Record<string, unknown>) ?? data
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
    creationDate: toDateOrNull(dates.creationDate ?? dates.timeStamp),
    declaredDate: toDateOrNull(dates.declaredDate),
    closedDate: toDateOrNull(dates.closedDate ?? dates.dateClosed),
    inProgressDate: toDateOrNull(dates.inProgressDate),
    interventionDate: toDateOrNull(dates.interventionDate),
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
// closedDate : posé au passage à "Terminé", effacé dès qu'on en ressort vers
// n'importe quel autre statut (même logique que côté app,
// icon_modify_or_delette.dart) - remis à jour si le ticket revient à Terminé.
//
// inProgressDate : posé au passage à "En cours", effacé uniquement si le
// ticket repasse à "Transmis" (à traiter) - contrairement à closedDate, un
// passage par "Terminé" ne l'efface pas (on garde la trace de la première
// prise en charge). Champ backoffice uniquement, jamais lu/écrit par l'app.
//
// markDeclared : à passer quand on fait sortir un ticket de "Non envoyé"
// depuis le BO (équivalent du passage "Non envoyé -> Transmis" côté app,
// icon_modify_or_delette.dart, qui pose declaredDate) - une fois posé, la
// règle Firestore interdit tout retour à "Non envoyé".
export async function updateSinistreStatut(
  residenceId: string,
  postId: string,
  statut: SinistreStatus,
  options?: { markDeclared?: boolean }
) {
  await updateDoc(doc(db, "residences", residenceId, "posts", postId), {
    statut,
    "dates.closedDate": statut === "Terminé" ? serverTimestamp() : deleteField(),
    ...(statut === "En cours" ? { "dates.inProgressDate": serverTimestamp() } : {}),
    ...(statut === "Transmis" ? { "dates.inProgressDate": deleteField() } : {}),
    ...(options?.markDeclared ? { "dates.declaredDate": serverTimestamp() } : {}),
  })
}

// Champ backoffice uniquement - posé quand une intervention est programmée
// depuis ce ticket (SinistreDetailPage, "Programmer une intervention") ;
// écrase la précédente si une nouvelle intervention est reprogrammée.
export async function updateSinistreInterventionDate(
  residenceId: string,
  postId: string,
  interventionDate: Date
) {
  await updateDoc(doc(db, "residences", residenceId, "posts", postId), {
    "dates.interventionDate": interventionDate,
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
