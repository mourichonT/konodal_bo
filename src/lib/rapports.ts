import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore"
import { db } from "@/firebase"

// Compte-rendu de fin d'intervention soumis par un prestataire externe via
// le lien de partage (create_shared_rapport, functions_python/main.py) -
// sous-collection dédiée posts/{postId}/rapports (pas un post "type: rapport"
// au même niveau que sinistres/events : l'app résident scanne toute la
// collection posts sans filtrer sur type, une restriction de lecture par
// type y casse Firestore en bloc sur toute requête de liste - cf. incident
// du 2026-07-19). Jamais visible d'un résident (cf. firestore.rules match
// /posts/{postId}/rapports/{id}), consultable uniquement ici.
export type Rapport = {
  id: string
  title: string
  description: string
  pathImage: string
  creationDate: Date | null
}

function toDateOrNull(value: unknown): Date | null {
  return value && typeof (value as { toDate?: unknown }).toDate === "function"
    ? (value as { toDate: () => Date }).toDate()
    : null
}

function toRapport(d: QueryDocumentSnapshot<DocumentData>): Rapport {
  const data = d.data()
  const dates = (data.dates as Record<string, unknown>) ?? data
  return {
    id: d.id,
    title: (data.title as string) ?? "",
    description: (data.description as string) ?? "",
    pathImage: (data.pathImage as string) ?? "",
    creationDate: toDateOrNull(dates.creationDate),
  }
}

export function subscribeToRapportsForEvent(
  residenceId: string,
  eventId: string,
  onData: (rapports: Rapport[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, "residences", residenceId, "posts", eventId, "rapports"),
    orderBy("dates.creationDate", "desc")
  )
  return onSnapshot(q, (snapshot) => onData(snapshot.docs.map(toRapport)), onError)
}
