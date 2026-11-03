import { collection, onSnapshot, type DocumentData, type DocumentSnapshot, type Unsubscribe } from "firebase/firestore"
import { db } from "@/firebase"
import { WELCOME_POST_TITLE } from "@/lib/communications"

// Contenus > Posts (superAdmin) : toutes les publications de toutes les
// résidences, tous types confondus, résidence par résidence (pas de
// collectionGroup côté connectkasa, même choix que useAllCommunications).

// Libellés de konodal_app/lib/models/enum/type_list.dart (comme
// POST_TYPE_LABELS de notifyNewPost, functions/index.js).
export const POST_TYPE_LABELS: Record<string, string> = {
  sinistres: "Sinistre",
  incivilites: "Incivilité",
  communication: "Communication",
  annonces: "Petite annonce",
  animaux: "Animal",
  sondage: "Sondage",
  rapport: "Compte-rendu",
  events: "Événement",
}

export type ContentPost = {
  id: string
  residenceId: string
  type: string
  title: string
  description: string
  pathImage: string
  isVideo: boolean
  user: string
  likes: number
  creationDate: Date | null
  // Masqué pour tous après 3 signalements (moderation.py), en attente de décision.
  hidden: boolean
}

function toDateOrNull(value: unknown): Date | null {
  return value && typeof (value as { toDate?: unknown }).toDate === "function"
    ? (value as { toDate: () => Date }).toDate()
    : null
}

function toContentPost(residenceId: string, d: DocumentSnapshot<DocumentData>): ContentPost {
  const data = d.data() ?? {}
  const dates = (data.dates as Record<string, unknown>) ?? data
  return {
    id: d.id,
    residenceId,
    type: (data.type as string) ?? "",
    title: (data.title as string) || (data.isWelcomePost === true ? WELCOME_POST_TITLE : ""),
    description: (data.description as string) ?? "",
    pathImage: (data.pathImage as string) ?? "",
    isVideo: (data.isVideo as boolean) ?? false,
    user: (data.user as string) ?? "",
    likes: Array.isArray(data.like) ? data.like.length : 0,
    creationDate: toDateOrNull(dates.creationDate ?? dates.timeStamp ?? data.timeStamp),
    hidden: (data.moderation as { status?: string } | undefined)?.status === "hidden",
  }
}

export function subscribeToResidencePosts(
  residenceId: string,
  onData: (posts: ContentPost[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, "residences", residenceId, "posts"),
    (snapshot) => onData(snapshot.docs.map((d) => toContentPost(residenceId, d))),
    onError
  )
}
