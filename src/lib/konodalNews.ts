import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore"
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage"
import { db, storage } from "@/firebase"

// Conversation officielle « Konodal » de l'app (Communication > Chat Konodal,
// superAdmin seulement) : une seule collection globale konodalNews, lue par
// tous les comptes, sans destinataire ni réponse. L'app affiche chaque
// document publié comme une bulle venant de « Konodal » (logo K, badge
// vérifié), dans l'ordre de publishedAt, et calcule elle-même les non-lus
// (users/{uid}/private/konodalNews.readAt, jamais touché par le BO).
// Format défini côté app (session konodal-app, 2026-11-12). Écrits par le
// serveur, jamais par le BO : pushSentAt et pushStats (konodal_news_push
// envoie la push une seule fois, à la publication, si sendPush).
const COLLECTION = "konodalNews"

export const KONODAL_NEWS_TITLE_MAX = 120
// Mêmes types et tailles que storage.rules (konodalNews/{newsId}) : le
// contentType est vérifié par la règle. Pas de WebM, illisible par le lecteur
// vidéo de l'app sur iPhone.
export const KONODAL_NEWS_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
export const KONODAL_NEWS_VIDEO_TYPES = ["video/mp4", "video/quicktime"]
export const KONODAL_NEWS_PHOTO_MAX_BYTES = 10 * 1024 * 1024
export const KONODAL_NEWS_VIDEO_MAX_BYTES = 100 * 1024 * 1024

export type KonodalNews = {
  id: string
  title: string
  body: string
  pathImage: string | null
  isVideo: boolean
  ctaLabel: string | null
  ctaUrl: string | null
  published: boolean
  publishedAt: Date | null
  sendPush: boolean
  pushSentAt: Date | null
  pushStats: { sent: number; failed: number } | null
  createdAt: Date | null
  updatedAt: Date | null
  createdBy: string | null
}

export type KonodalNewsInput = {
  title: string
  body: string
  // File : nouveau média ; null : média retiré ; undefined : média inchangé.
  media?: File | null
  ctaLabel: string
  ctaUrl: string
  sendPush: boolean
}

function toDate(value: unknown): Date | null {
  return value && typeof (value as { toDate?: unknown }).toDate === "function"
    ? (value as { toDate: () => Date }).toDate()
    : null
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

function toKonodalNews(snap: QueryDocumentSnapshot<DocumentData>): KonodalNews {
  const d = snap.data()
  const stats = d.pushStats as Record<string, unknown> | undefined
  return {
    id: snap.id,
    title: String(d.title ?? ""),
    body: String(d.body ?? ""),
    pathImage: text(d.pathImage),
    isVideo: d.isVideo === true,
    ctaLabel: text(d.ctaLabel),
    ctaUrl: text(d.ctaUrl),
    published: d.published === true,
    publishedAt: toDate(d.publishedAt),
    sendPush: d.sendPush === true,
    pushSentAt: toDate(d.pushSentAt),
    pushStats: stats ? { sent: Number(stats.sent ?? 0), failed: Number(stats.failed ?? 0) } : null,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
    createdBy: text(d.createdBy),
  }
}

// Brouillons d'abord (dernier modifié en haut), puis les messages publiés,
// du plus récent au plus ancien.
function compareNews(a: KonodalNews, b: KonodalNews): number {
  if (a.published !== b.published) return a.published ? 1 : -1
  const dateOf = (n: KonodalNews) => (n.published ? n.publishedAt : (n.updatedAt ?? n.createdAt))?.getTime() ?? 0
  return dateOf(b) - dateOf(a)
}

export function subscribeToKonodalNews(
  onData: (news: KonodalNews[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  // Toute la collection (quelques dizaines de messages) : un orderBy sur
  // publishedAt écarterait les brouillons, qui n'en ont pas.
  return onSnapshot(
    collection(db, COLLECTION),
    (snap) => onData(snap.docs.map(toKonodalNews).sort(compareNews)),
    onError
  )
}

// Lien du bouton : http ou https seulement (règle de l'app).
export function isValidCtaUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

// Message d'erreur du média choisi, null s'il convient.
export function konodalNewsMediaError(file: File): string | null {
  if (KONODAL_NEWS_PHOTO_TYPES.includes(file.type)) {
    return file.size > KONODAL_NEWS_PHOTO_MAX_BYTES ? "Photo trop lourde : 10 Mo maximum" : null
  }
  if (KONODAL_NEWS_VIDEO_TYPES.includes(file.type)) {
    return file.size > KONODAL_NEWS_VIDEO_MAX_BYTES ? "Vidéo trop lourde : 100 Mo maximum" : null
  }
  return "Format non pris en charge : JPG, PNG, WebP, GIF, MP4 ou MOV"
}

// MOV d'iPhone souvent en HEVC : illisible sur Android et dans la webapp.
export function isMovFile(file: File): boolean {
  return file.type === "video/quicktime"
}

function extensionOf(file: File): string {
  const fromName = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : undefined
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName
  const fromType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
  }
  return fromType[file.type] ?? "bin"
}

// konodalNews/{newsId}/{uuid}.{ext}, avec son contentType. onProgress : 0 à 1.
async function uploadMedia(newsId: string, file: File, onProgress?: (ratio: number) => void): Promise<string> {
  const fileRef = ref(storage, `${COLLECTION}/${newsId}/${crypto.randomUUID()}.${extensionOf(file)}`)
  const task = uploadBytesResumable(fileRef, file, { contentType: file.type })
  await new Promise<void>((resolve, reject) => {
    task.on(
      "state_changed",
      (s) => onProgress?.(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0),
      reject,
      () => resolve()
    )
  })
  return getDownloadURL(task.snapshot.ref)
}

async function deleteMedia(url: string | null): Promise<void> {
  if (!url) return
  try {
    await deleteObject(ref(storage, url))
  } catch (err) {
    // Fichier déjà absent : rien à faire ; le reste n'empêche pas l'action.
    console.warn("Média konodalNews non supprimé :", err)
  }
}

// Création ou modification. publish : true publie (ou garde publié), false
// enregistre en brouillon - seulement pour un message pas encore publié.
// publishedAt n'est posé qu'au passage en publié : modifier un message publié
// change la bulle en direct sans le déplacer dans le fil. sendPush ne change
// plus après la première publication (push envoyée une seule fois).
export async function saveKonodalNews(
  uid: string,
  existing: KonodalNews | null,
  input: KonodalNewsInput,
  publish: boolean,
  onProgress?: (ratio: number) => void
): Promise<void> {
  const newsRef = existing ? doc(db, COLLECTION, existing.id) : doc(collection(db, COLLECTION))
  const uploaded = input.media ? await uploadMedia(newsRef.id, input.media, onProgress) : null
  const ctaLabel = input.ctaLabel.trim()
  const ctaUrl = input.ctaUrl.trim()
  const hasCta = !!ctaLabel && !!ctaUrl
  const removed = existing ? deleteField() : undefined

  const data: Record<string, unknown> = {
    title: input.title.trim(),
    body: input.body.trim(),
    updatedAt: serverTimestamp(),
    published: publish,
  }
  if (uploaded) {
    data.pathImage = uploaded
    data.isVideo = input.media!.type.startsWith("video/")
  } else if (input.media === null) {
    if (removed) data.pathImage = removed
    data.isVideo = false
  } else if (!existing) {
    data.isVideo = false
  }
  if (hasCta) {
    data.ctaLabel = ctaLabel
    data.ctaUrl = ctaUrl
  } else if (removed) {
    data.ctaLabel = removed
    data.ctaUrl = removed
  }
  const everPublished = !!existing?.publishedAt
  if (!everPublished) data.sendPush = input.sendPush
  if (publish && !existing?.published) data.publishedAt = serverTimestamp()
  if (!existing) {
    data.createdAt = serverTimestamp()
    data.createdBy = uid
  }

  try {
    if (existing) {
      await updateDoc(newsRef, data)
    } else {
      await setDoc(newsRef, data)
    }
  } catch (err) {
    await deleteMedia(uploaded)
    throw err
  }
  // Ancien média remplacé ou retiré.
  if (existing?.pathImage && (uploaded || input.media === null)) await deleteMedia(existing.pathImage)
}

// Retire le message de la conversation de tous les comptes (gardé en
// brouillon dans le BO).
export async function unpublishKonodalNews(news: KonodalNews): Promise<void> {
  await updateDoc(doc(db, COLLECTION, news.id), { published: false, updatedAt: serverTimestamp() })
}

// Republie un message dépublié : nouveau publishedAt, il revient en bas du
// fil. La push n'est pas renvoyée (pushSentAt).
export async function publishKonodalNews(news: KonodalNews): Promise<void> {
  await updateDoc(doc(db, COLLECTION, news.id), {
    published: true,
    publishedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function deleteKonodalNews(news: KonodalNews): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, news.id))
  await deleteMedia(news.pathImage)
}
