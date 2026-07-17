import {
  addDoc,
  collection,
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
import { EVENT_TYPE_PRESTATION, type ResidenceEvent } from "@/types/event"

function toDateOrNull(value: unknown): Date | null {
  return value && typeof (value as { toDate?: unknown }).toDate === "function"
    ? (value as { toDate: () => Date }).toDate()
    : null
}

// Les champs event vivent sous une sous-clé `event` côté app (Post.toMap()/
// fromMap(), konodal_app/lib/models/pages_models/post.dart) - d'anciens
// documents (avant ce refactor) les ont à plat, relus tels quels sans
// migration, même pattern que `location` dans sinistres.ts. La date de
// création vit elle sous `dates.creationDate` (cf. sinistres.ts pour le même
// fallback triple : nouveau nom, ancien nom déjà imbriqué, jamais migré).
function toResidenceEvent(residenceId: string, d: DocumentSnapshot<DocumentData>): ResidenceEvent {
  const data = d.data() ?? {}
  const event = (data.event as Record<string, unknown>) ?? data
  const dates = (data.dates as Record<string, unknown>) ?? data
  return {
    id: d.id,
    residenceId,
    title: (data.title as string) ?? "",
    description: (data.description as string) ?? "",
    eventDate: toDateOrNull(event.eventDate),
    prestaName: (event.prestaName as string) ?? "",
    creationDate: toDateOrNull(dates.creationDate ?? dates.timeStamp),
    user: (data.user as string) ?? "",
  }
}

function includesPrestation(d: DocumentSnapshot<DocumentData>): boolean {
  const data = d.data() ?? {}
  const event = (data.event as Record<string, unknown>) ?? data
  const eventType = (event.eventType as unknown[]) ?? []
  return eventType.includes(EVENT_TYPE_PRESTATION)
}

// residences/{id}/posts, filtré type == "events" : pas de filtre Firestore
// sur le tableau imbriqué event.eventType (pas d'index dédié, comme pour les
// sinistres) - le tri "prestation uniquement" se fait client-side.
export function subscribeToResidenceEvents(
  residenceId: string,
  onData: (events: ResidenceEvent[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(collection(db, "residences", residenceId, "posts"), where("type", "==", "events"))
  return onSnapshot(
    q,
    (snapshot) =>
      onData(
        snapshot.docs.filter(includesPrestation).map((d) => toResidenceEvent(residenceId, d))
      ),
    onError
  )
}

export function subscribeToEvent(
  residenceId: string,
  postId: string,
  onData: (event: ResidenceEvent | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "residences", residenceId, "posts", postId),
    (snapshot) => onData(snapshot.exists() ? toResidenceEvent(residenceId, snapshot) : null),
    onError
  )
}

export type EventInput = {
  title: string
  description: string
  eventDate: Date
  prestaName: string
}

// Réservé isSuperAdmin() côté firestore.rules (posts/{id}.create) - la règle
// de base (isResidenceMember + auteur == uid) ne couvre pas le compte
// backoffice, cf. mémoire projet sur ce lot.
export async function createEvent(residenceId: string, uid: string, input: EventInput) {
  await addDoc(collection(db, "residences", residenceId, "posts"), {
    type: "events",
    refResidence: residenceId,
    user: uid,
    hideUser: false,
    title: input.title,
    description: input.description,
    dates: { creationDate: serverTimestamp() },
    event: {
      eventDate: input.eventDate,
      eventType: [EVENT_TYPE_PRESTATION],
      prestaName: input.prestaName,
    },
  })
}

export async function updateEvent(residenceId: string, postId: string, input: EventInput) {
  await updateDoc(doc(db, "residences", residenceId, "posts", postId), {
    title: input.title,
    description: input.description,
    "event.eventDate": input.eventDate,
    "event.prestaName": input.prestaName,
  })
}
