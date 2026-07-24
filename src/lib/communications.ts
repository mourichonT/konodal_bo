import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore"
import { db } from "@/firebase"
import type { Communication, CommunicationAudience } from "@/types/communication"

function toDateOrNull(value: unknown): Date | null {
  return value && typeof (value as { toDate?: unknown }).toDate === "function"
    ? (value as { toDate: () => Date }).toDate()
    : null
}

// Mêmes conventions que toSinistre (lib/sinistres.ts) : dates sous une
// sous-clé `dates` côté app, fallback `timeStamp` conservé pour les
// documents pas encore repris par migrate_post_dates_rename.py.
function toCommunication(residenceId: string, d: DocumentSnapshot<DocumentData>): Communication {
  const data = d.data() ?? {}
  const dates = (data.dates as Record<string, unknown>) ?? data
  return {
    id: d.id,
    residenceId,
    title: (data.title as string) ?? "",
    description: (data.description as string) ?? "",
    pathImage: (data.pathImage as string) ?? "",
    isVideo: (data.isVideo as boolean) ?? false,
    creationDate: toDateOrNull(dates.creationDate ?? dates.timeStamp),
    user: (data.user as string) ?? "",
    audience: data.audience === "proprietaires" ? "proprietaires" : "all",
    groupId: (data.communicationGroupId as string) || d.id,
  }
}

// residences/{id}/posts, filtré type == "communication" (cf.
// konodal_app/lib/models/enum/type_list.dart) - pas de collectionGroup
// disponible côté connectkasa, même agrégation résidence par résidence que
// subscribeToResidenceSinistres.
export function subscribeToResidenceCommunications(
  residenceId: string,
  onData: (communications: Communication[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(collection(db, "residences", residenceId, "posts"), where("type", "==", "communication"))
  return onSnapshot(
    q,
    (snapshot) => onData(snapshot.docs.map((d) => toCommunication(residenceId, d))),
    onError
  )
}

export function subscribeToCommunication(
  residenceId: string,
  postId: string,
  onData: (communication: Communication | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "residences", residenceId, "posts", postId),
    (snapshot) => onData(snapshot.exists() ? toCommunication(residenceId, snapshot) : null),
    onError
  )
}

export type CommunicationInput = {
  title: string
  description: string
  audience: CommunicationAudience
  // Un seul id généré par soumission du formulaire (CommunicationFormDialog),
  // partagé par toutes les résidences cochées - permet de regrouper les
  // copies d'une même publication dans la liste BO (useAllCommunications).
  groupId: string
}

// Réservé isProfessionnelResidence()/isSuperAdmin() côté firestore.rules
// (posts/{id}.create, bypass déjà existant, pas de restriction sur `type`) -
// même patron que createEvent (lib/events.ts). Pas d'image (formulaire BO
// volontairement sans upload, cf. demande utilisateur). `audience` omis si
// "all" (valeur par défaut relue par toCommunication) - seul "proprietaires"
// est écrit explicitement, cf. Post.audience côté app (toMap()).
// `communicationGroupId` : champ backoffice uniquement, absent du modèle
// Dart (Post.fromMap ignore silencieusement les clés inconnues, même
// précaution que priority/interventionDate sur les sinistres) - jamais lu ni
// écrit par l'app.
export async function createCommunication(residenceId: string, uid: string, input: CommunicationInput) {
  await addDoc(collection(db, "residences", residenceId, "posts"), {
    type: "communication",
    refResidence: residenceId,
    user: uid,
    hideUser: false,
    title: input.title,
    description: input.description,
    dates: { creationDate: serverTimestamp() },
    communicationGroupId: input.groupId,
    ...(input.audience === "proprietaires" ? { audience: "proprietaires" } : {}),
  })
}

