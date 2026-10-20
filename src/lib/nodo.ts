import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { db, functions } from "@/firebase"

// Nodo, assistant IA du BO : la boucle agent (Claude) tourne côté serveur
// (nodo_send_message, konodal_app/functions_python/nodo.py), qui écrit la
// réponse au fil de l'eau dans users/{uid}/nodoConversations/{cid}/messages -
// le panneau l'affiche en direct via onSnapshot, l'appel callable ne sert
// qu'à déclencher. Conversations privées à leur auteur (firestore.rules).

export type NodoActionType = "communication" | "event" | "email" | "intervention"
export type NodoActionStatus = "pending" | "done" | "cancelled" | "error"

export type NodoAction = {
  id: string
  type: NodoActionType
  residenceId: string
  residenceName: string
  summary: string
  status: NodoActionStatus
  detail?: string
  payload: {
    title?: string
    description?: string
    audience?: "all" | "proprietaires"
    eventDate?: string
    prestaName?: string
    recipientUid?: string
    recipientName?: string
    recipientEmail?: string
    subject?: string
    body?: string
    // intervention : programmée sur un sinistre, ordre envoyé au prestataire
    // (cf. _intervention_payload, functions_python/nodo.py).
    sinistreId?: string
    ticket?: string
    sinistreTitle?: string
    sinistreStatut?: string
    contactId?: string
    prestaService?: string
    prestaMail?: string
    message?: string
    reason?: string
    locationElement?: string
    locationFloor?: string
  }
}

export type NodoMessage = {
  id: string
  role: "user" | "assistant"
  text: string
  status?: "streaming" | "done" | "error"
  activity?: string | null
  actions: NodoAction[]
  error?: string
  createdAt: Date | null
}

export type NodoConversation = {
  id: string
  title: string
  updatedAt: Date | null
}

function toDate(value: unknown): Date | null {
  return value && typeof (value as { toDate?: unknown }).toDate === "function"
    ? (value as { toDate: () => Date }).toDate()
    : null
}

const conversationsCollection = (uid: string) => collection(db, "users", uid, "nodoConversations")

// Id généré côté client : le panneau écoute la conversation avant même que
// le serveur l'ait créée.
export function newNodoConversationId(uid: string): string {
  return doc(conversationsCollection(uid)).id
}

export function listenNodoConversations(
  uid: string,
  onData: (conversations: NodoConversation[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(conversationsCollection(uid), orderBy("updatedAt", "desc"), limit(50))
  return onSnapshot(
    q,
    (snapshot) =>
      onData(
        snapshot.docs.map((d) => ({
          id: d.id,
          title: (d.data().title as string) || "Conversation",
          updatedAt: toDate(d.data().updatedAt),
        }))
      ),
    onError
  )
}

export function listenNodoMessages(
  uid: string,
  conversationId: string,
  onData: (messages: NodoMessage[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(collection(conversationsCollection(uid), conversationId, "messages"), orderBy("createdAt", "asc"))
  return onSnapshot(
    q,
    (snapshot) =>
      onData(
        snapshot.docs.map((d) => {
          const data = d.data({ serverTimestamps: "estimate" })
          return {
            id: d.id,
            role: data.role === "user" ? "user" : "assistant",
            text: (data.text as string) ?? "",
            status: data.status as NodoMessage["status"],
            activity: (data.activity as string | null) ?? null,
            actions: (data.actions as NodoAction[] | undefined) ?? [],
            error: data.error as string | undefined,
            createdAt: toDate(data.createdAt),
          }
        })
      ),
    onError
  )
}

// La boucle agent peut lire plusieurs documents : bien au-delà des 70 s par
// défaut du SDK (la fonction a timeout_sec=300).
const NODO_CALL_TIMEOUT_MS = 310_000

export async function sendNodoMessage(conversationId: string, message: string) {
  const call = httpsCallable<{ conversationId: string; message: string }, { messageId: string }>(
    functions,
    "nodo_send_message",
    { timeout: NODO_CALL_TIMEOUT_MS }
  )
  await call({ conversationId, message })
}

// Champ du brouillon modifié par l'utilisateur avant confirmation : Nodo en
// tire des préférences durables (mémoire de l'agence, _learn_from_edits).
export type NodoActionEdit = { field: string; proposed: string; final: string }

export async function reportNodoActionResult(
  conversationId: string,
  messageId: string,
  actionId: string,
  status: Exclude<NodoActionStatus, "pending">,
  detail?: string,
  edits?: NodoActionEdit[]
) {
  const call = httpsCallable<
    {
      conversationId: string
      actionResult: {
        messageId: string
        actionId: string
        status: string
        detail?: string
        edits?: NodoActionEdit[]
      }
    },
    { ok: boolean }
  >(functions, "nodo_send_message", { timeout: 60_000 })
  await call({ conversationId, actionResult: { messageId, actionId, status, detail, edits } })
}

export async function deleteNodoConversation(uid: string, conversationId: string) {
  const ref = doc(conversationsCollection(uid), conversationId)
  const messages = await getDocs(collection(ref, "messages"))
  await Promise.all(messages.docs.map((m) => deleteDoc(m.ref)))
  await deleteDoc(ref)
}
