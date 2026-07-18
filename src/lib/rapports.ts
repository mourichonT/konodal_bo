import {
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore"
import { db } from "@/firebase"

// Compte-rendu de fin d'intervention soumis par un prestataire externe via
// le lien de partage (create_shared_rapport, functions_python/main.py) -
// jamais visible d'un résident (cf. firestore.rules match /posts/{postId} :
// lecture "rapport" restreinte à isCsMember/isSuperAdmin), consultable
// uniquement ici, dans la fiche de l'intervention d'origine (linkedEventId).
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
    collection(db, "residences", residenceId, "posts"),
    where("type", "==", "rapport"),
    where("linkedEventId", "==", eventId)
  )
  return onSnapshot(
    q,
    (snapshot) => {
      const rapports = snapshot.docs.map(toRapport)
      rapports.sort((a, b) => (b.creationDate?.getTime() ?? 0) - (a.creationDate?.getTime() ?? 0))
      onData(rapports)
    },
    onError
  )
}
