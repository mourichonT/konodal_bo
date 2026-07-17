import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore"
import { db } from "@/firebase"

// Reflète Comment.toMap()/fromMap() côté app (models/pages_models/comment.dart)
// - `docId` est l'ID Firestore du document (utilisé pour adresser la
// sous-collection replies), `fieldId` est le champ `id` (UUID) que l'app
// utilise pour ses propres requêtes where("id", ==) - les deux sont
// distincts et doivent coexister pour rester compatible avec l'app mobile.
export type PostComment = {
  docId: string
  fieldId: string
  comment: string
  user: string
  timestamp: Date | null
  replies: PostComment[]
}

function toDateOrNull(value: unknown): Date | null {
  return value && typeof (value as { toDate?: unknown }).toDate === "function"
    ? (value as { toDate: () => Date }).toDate()
    : null
}

function toComment(
  d: QueryDocumentSnapshot<DocumentData>,
  replies: PostComment[] = []
): PostComment {
  const data = d.data()
  return {
    docId: d.id,
    fieldId: (data.id as string) ?? d.id,
    comment: (data.comment as string) ?? "",
    user: (data.user as string) ?? "",
    timestamp: toDateOrNull(data.timestamp),
    replies,
  }
}

// Un seul niveau de réponses affiché (comme comment_tile.dart côté app qui
// n'imbrique jamais plus profond) - pas de collectionGroup disponible, donc
// une souscription "replies" par commentaire plutôt qu'une requête globale,
// même choix que le reste du projet. Souscription temps réel (pas un simple
// getDocs) sur chaque sous-collection replies : un onSnapshot sur "comments"
// ne se redéclenche pas quand seule une sous-collection change, donc un
// getDocs ponctuel ne verrait jamais les réponses ajoutées après coup.
export function subscribeToPostComments(
  residenceId: string,
  postId: string,
  onData: (comments: PostComment[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const commentsQuery = query(
    collection(db, "residences", residenceId, "posts", postId, "comments"),
    orderBy("timestamp", "desc")
  )

  let topLevel: QueryDocumentSnapshot<DocumentData>[] = []
  const repliesByCommentId: Record<string, PostComment[]> = {}
  const repliesUnsubscribes: Record<string, Unsubscribe> = {}

  function emit() {
    onData(topLevel.map((d) => toComment(d, repliesByCommentId[d.id] ?? [])))
  }

  const unsubscribeComments = onSnapshot(
    commentsQuery,
    (snapshot) => {
      topLevel = snapshot.docs

      const currentIds = new Set(snapshot.docs.map((d) => d.id))
      for (const id of Object.keys(repliesUnsubscribes)) {
        if (!currentIds.has(id)) {
          repliesUnsubscribes[id]()
          delete repliesUnsubscribes[id]
          delete repliesByCommentId[id]
        }
      }

      for (const commentDoc of snapshot.docs) {
        if (repliesUnsubscribes[commentDoc.id]) continue
        repliesUnsubscribes[commentDoc.id] = onSnapshot(
          query(collection(commentDoc.ref, "replies"), orderBy("timestamp", "asc")),
          (repliesSnapshot) => {
            repliesByCommentId[commentDoc.id] = repliesSnapshot.docs.map((r) => toComment(r))
            emit()
          },
          onError
        )
      }

      emit()
    },
    onError
  )

  return () => {
    unsubscribeComments()
    Object.values(repliesUnsubscribes).forEach((unsub) => unsub())
  }
}

// Nouveau commentaire de premier niveau (originalCommment: true côté modèle
// Dart) - c'est la "réponse" par défaut au sinistre lui-même.
export async function addPostComment(
  residenceId: string,
  postId: string,
  uid: string,
  text: string
) {
  await addDoc(collection(db, "residences", residenceId, "posts", postId, "comments"), {
    comment: text,
    user: uid,
    timestamp: serverTimestamp(),
    like: [],
    id: crypto.randomUUID(),
    originalCommment: true,
    initialComment: null,
  })
}

// Réponse à un commentaire de premier niveau précis - stockée dans sa
// sous-collection `replies`, avec `initialComment` pointant vers le champ
// `id` (pas l'ID Firestore) du commentaire parent, comme côté app.
export async function addPostCommentReply(
  residenceId: string,
  postId: string,
  parent: { docId: string; fieldId: string },
  uid: string,
  text: string
) {
  await addDoc(
    collection(
      db,
      "residences",
      residenceId,
      "posts",
      postId,
      "comments",
      parent.docId,
      "replies"
    ),
    {
      comment: text,
      user: uid,
      timestamp: serverTimestamp(),
      like: [],
      id: crypto.randomUUID(),
      originalCommment: false,
      initialComment: parent.fieldId,
    }
  )
}

// `segments` = ["comments", docId] pour un commentaire de premier niveau, ou
// ["comments", parentDocId, "replies", docId] pour une réponse.
export async function deletePostComment(residenceId: string, postId: string, segments: string[]) {
  await deleteDoc(doc(db, "residences", residenceId, "posts", postId, ...segments))
}
