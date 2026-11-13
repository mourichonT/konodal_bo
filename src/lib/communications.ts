import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore"
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage"
import { db, storage } from "@/firebase"
import type { Communication, CommunicationAudience } from "@/types/communication"
import type { LinkPreview } from "@/lib/linkPreview"

function toDateOrNull(value: unknown): Date | null {
  return value && typeof (value as { toDate?: unknown }).toDate === "function"
    ? (value as { toDate: () => Date }).toDate()
    : null
}

// Mêmes conventions que toSinistre (lib/sinistres.ts) : dates sous une
// sous-clé `dates` côté app, fallback `timeStamp` conservé pour les
// documents pas encore repris par migrate_post_dates_rename.py.
// Post de bienvenue publié à la création de chaque résidence
// (createResidenceWelcomePost, functions/index.js) : sans titre avant le
// 15/10/2026, et regroupé en une seule ligne dans la liste des
// communications plutôt qu'une par résidence.
export const WELCOME_POST_TITLE = "Bienvenue sur le fil de la résidence"
const WELCOME_GROUP_ID = "welcome-post"

function toCommunication(residenceId: string, d: DocumentSnapshot<DocumentData>): Communication {
  const data = d.data() ?? {}
  const dates = (data.dates as Record<string, unknown>) ?? data
  const isWelcomePost = data.isWelcomePost === true
  return {
    id: d.id,
    residenceId,
    title: (data.title as string) || (isWelcomePost ? WELCOME_POST_TITLE : ""),
    description: (data.description as string) ?? "",
    pathImage: (data.pathImage as string) ?? "",
    isVideo: (data.isVideo as boolean) ?? false,
    isPhoto: data.isPhoto === true,
    creationDate: toDateOrNull(dates.creationDate ?? dates.timeStamp),
    user: (data.user as string) ?? "",
    audience: data.audience === "proprietaires" ? "proprietaires" : "all",
    groupId: isWelcomePost ? WELCOME_GROUP_ID : (data.communicationGroupId as string) || d.id,
    link: data.link ? (data.link as LinkPreview) : undefined,
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
  // Résolu une seule fois par soumission (fetchLinkPreview), partagé par
  // toutes les copies - cf. Communication.link.
  link?: LinkPreview
  // Photo jointe (CommunicationFormDialog), envoyée une fois par résidence.
  photo?: File
}

// Photo d'une communication : formats affichés par l'app et les navigateurs.
// Pas de HEIC : l'app ne le convertit en JPEG qu'à l'envoi depuis l'app
// (firestore_storage_repository.dart), un HEIC du BO ne s'afficherait pas.
export const COMMUNICATION_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
export const COMMUNICATION_PHOTO_MAX_BYTES = 10 * 1024 * 1024

// Réservé isProfessionnelResidence()/isSuperAdmin() côté firestore.rules
// (posts/{id}.create, bypass déjà existant, pas de restriction sur `type`) -
// même patron que createEvent (lib/events.ts). `audience` omis si
// "all" (valeur par défaut relue par toCommunication) - seul "proprietaires"
// est écrit explicitement, cf. Post.audience côté app (toMap()).
// `communicationGroupId` : champ backoffice uniquement, absent du modèle
// Dart (Post.fromMap ignore silencieusement les clés inconnues, même
// précaution que priority/interventionDate sur les sinistres) - jamais lu ni
// écrit par l'app.
// Photo : même dossier que l'app (residences/{id}/communication/{uuid}, nom
// sans extension, cf. Post.isVideo) et mêmes champs (pathImage = URL de
// téléchargement, isPhoto = vraie photo affichée avec le texte, pas une
// capture de texte mis en forme). Un fichier par résidence : l'app supprime
// la photo avec le post (removeFileFromUrl), un fichier partagé disparaîtrait
// des autres copies. Storage autorise le superAdmin et le BO de la résidence.
export async function createCommunication(residenceId: string, uid: string, input: CommunicationInput) {
  await withPhoto(residenceId, input.photo, async (pathImage) => {
    await addDoc(collection(db, "residences", residenceId, "posts"), {
      type: "communication",
      refResidence: residenceId,
      user: uid,
      hideUser: false,
      dates: { creationDate: serverTimestamp() },
      ...communicationContent(input, pathImage),
    })
  })
}

// Contenu commun au post et à la communication programmée, recopié tel quel
// par le serveur à la publication (communication_post,
// functions_python/scheduled_communications.py) : garder les deux alignés.
function communicationContent(input: CommunicationInput, pathImage: string) {
  return {
    title: input.title,
    description: input.description,
    communicationGroupId: input.groupId,
    ...(input.audience === "proprietaires" ? { audience: "proprietaires" } : {}),
    ...(input.link ? { link: input.link } : {}),
    ...(pathImage ? { pathImage, isPhoto: true } : {}),
  }
}

// Envoie la photo (s'il y en a une) puis écrit le document ; si l'écriture
// échoue, la photo n'est rattachée à rien et elle est supprimée.
async function withPhoto(residenceId: string, photo: File | undefined, write: (pathImage: string) => Promise<void>) {
  const photoRef = photo ? ref(storage, `residences/${residenceId}/communication/${crypto.randomUUID()}`) : null
  let pathImage = ""
  if (photoRef && photo) {
    await uploadBytes(photoRef, photo, { contentType: photo.type })
    pathImage = await getDownloadURL(photoRef)
  }
  try {
    await write(pathImage)
  } catch (err) {
    if (photoRef) await deleteObject(photoRef).catch(() => {})
    throw err
  }
}

// ---------------------------------------------------------------------------
// Communications programmées : residences/{id}/scheduledCommunications/{id},
// publiées à publishAt par le serveur (publish_scheduled_communications,
// chaque minute), qui crée le post sous le même id et supprime ce document.
// Rien n'est visible dans l'app avant : le post n'existe pas encore. La
// notification des résidents part à la publication (notifyNewPost).
// firestore.rules : superAdmin et BO de la résidence ; createdBy = auteur ;
// ensuite, seule l'heure (publishAt) peut changer.
// ---------------------------------------------------------------------------

export type ScheduledCommunication = {
  id: string
  residenceId: string
  title: string
  description: string
  audience: CommunicationAudience
  // Même regroupement que Communication.groupId (une copie par résidence).
  groupId: string
  publishAt: Date | null
  createdBy: string
  pathImage: string
  link?: LinkPreview
}

function toScheduledCommunication(residenceId: string, d: DocumentSnapshot<DocumentData>): ScheduledCommunication {
  const data = d.data() ?? {}
  return {
    id: d.id,
    residenceId,
    title: (data.title as string) ?? "",
    description: (data.description as string) ?? "",
    audience: data.audience === "proprietaires" ? "proprietaires" : "all",
    groupId: (data.communicationGroupId as string) || d.id,
    publishAt: toDateOrNull(data.publishAt),
    createdBy: (data.createdBy as string) ?? "",
    pathImage: (data.pathImage as string) ?? "",
    link: data.link ? (data.link as LinkPreview) : undefined,
  }
}

function scheduledCollection(residenceId: string) {
  return collection(db, "residences", residenceId, "scheduledCommunications")
}

export async function scheduleCommunication(
  residenceId: string,
  uid: string,
  input: CommunicationInput,
  publishAt: Date
) {
  await withPhoto(residenceId, input.photo, async (pathImage) => {
    await addDoc(scheduledCollection(residenceId), {
      createdBy: uid,
      createdAt: serverTimestamp(),
      publishAt: Timestamp.fromDate(publishAt),
      ...communicationContent(input, pathImage),
    })
  })
}

export function subscribeToResidenceScheduledCommunications(
  residenceId: string,
  onData: (items: ScheduledCommunication[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    scheduledCollection(residenceId),
    (snapshot) => onData(snapshot.docs.map((d) => toScheduledCommunication(residenceId, d))),
    onError
  )
}

export class AlreadyPublishedError extends Error {
  constructor() {
    super("Cette communication vient d'être publiée.")
  }
}

// Transaction : si le serveur l'a publiée entre-temps (document supprimé), on
// ne touche à rien, surtout pas à la photo, désormais celle du post.
export async function cancelScheduledCommunication(item: ScheduledCommunication) {
  const scheduledRef = doc(scheduledCollection(item.residenceId), item.id)
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(scheduledRef)
    if (!snap.exists()) throw new AlreadyPublishedError()
    transaction.delete(scheduledRef)
  })
  if (item.pathImage) await deleteObject(ref(storage, item.pathImage)).catch(() => {})
}

// Échoue (not-found) si le serveur l'a publiée entre-temps.
export async function rescheduleCommunication(item: ScheduledCommunication, publishAt: Date) {
  try {
    await updateDoc(doc(scheduledCollection(item.residenceId), item.id), {
      publishAt: Timestamp.fromDate(publishAt),
    })
  } catch (err) {
    if ((err as { code?: string }).code === "not-found") throw new AlreadyPublishedError()
    throw err
  }
}

