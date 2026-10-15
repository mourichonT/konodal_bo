import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { db, functions } from "@/firebase"

// Card "Échanges mails" de la fiche utilisateur (UserEmailsCard). Deux
// sources :
// - users/{uid}/emails : journal des mails envoyés par Konodal à ce compte
//   (_log_user_email, functions_python) - écrit par le serveur seulement ;
// - residences/{id}/mail : messages écrits par le résident à son syndic
//   depuis l'app (senderUid) et réponses rapatriées par IMAP (from), même
//   fil par lot (lotId).

// fromUser : réponse de l'utilisateur à un mail Konodal (_store_user_replies).
export type UserEmailSource = "konodal" | "fromUser" | "toSyndic" | "fromSyndic" | "residence"

export type UserEmail = {
  id: string
  source: UserEmailSource
  subject: string
  text: string
  html: string | null
  date: Date | null
  success: boolean
  error: string | null
  kind: string | null
  sentBy: string | null
  redacted: boolean
  // Destinataire(s) ou expéditeur affiché(s).
  counterpart: string
}

const KIND_LABELS: Record<string, string> = {
  bo_message: "Message du backoffice",
  lot_invite: "Invitation à un lot",
  residence_request_received: "Demande de résidence reçue",
  bo_access: "Accès au backoffice",
  offer_invite: "Offre Konodal",
  password_reset: "Mot de passe oublié",
  sinistre: "Sinistre déclaré",
  lot_modification_request: "Demande de modification de lot",
  radiation_request: "Demande de radiation",
  manual: "Envoi manuel",
}

export function emailKindLabel(kind: string | null): string | null {
  return kind ? (KIND_LABELS[kind] ?? null) : null
}

function toDate(value: unknown): Date | null {
  return value && typeof (value as Timestamp).toDate === "function" ? (value as Timestamp).toDate() : null
}

function fromLog(snap: QueryDocumentSnapshot<DocumentData>): UserEmail {
  const d = snap.data()
  const inbound = d.direction === "inbound"
  return {
    id: `log:${snap.id}`,
    source: inbound ? "fromUser" : "konodal",
    subject: d.subject ?? "",
    text: d.text ?? "",
    html: d.html ?? null,
    date: toDate(d.sentAt),
    success: d.success !== false,
    error: d.error ?? null,
    kind: d.kind ?? null,
    sentBy: d.sentBy ?? null,
    redacted: d.redacted === true,
    counterpart: (inbound ? d.from : d.to) ?? "",
  }
}

export function subscribeToUserEmails(
  uid: string,
  onData: (emails: UserEmail[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "users", uid, "emails"), orderBy("sentAt", "desc"), limit(100)),
    (snap) => onData(snap.docs.map(fromLog)),
    onError
  )
}

// Contenu saisi dans l'app (texte brut) ou mail d'intervention du BO (HTML).
function looksLikeHtml(value: string): boolean {
  return /<(html|table|body|div|p)[\s>]/i.test(value)
}

function fromResidenceMail(residenceId: string, uid: string, snap: QueryDocumentSnapshot<DocumentData>): UserEmail {
  const d = snap.data()
  const message = (d.message as Record<string, string> | undefined) ?? {}
  const content = message.html ?? message.text ?? ""
  const source: UserEmailSource = d.senderUid === uid ? "toSyndic" : d.from ? "fromSyndic" : "residence"
  const to = Array.isArray(d.to) ? (d.to as string[]).join(", ") : ""
  return {
    id: `mail:${residenceId}:${snap.id}`,
    source,
    subject: message.subject ?? "",
    text: looksLikeHtml(content) ? "" : content,
    html: looksLikeHtml(content) ? content : null,
    date: toDate(d.startTime),
    success: d.status !== "error",
    error: null,
    kind: null,
    sentBy: null,
    redacted: false,
    counterpart: d.from ?? to,
  }
}

// Une requête par résidence (règles scopées par résidence) : un compte sans
// accès à l'une d'elles (agent gérance locative) la voit simplement ignorée.
export async function fetchResidenceThreads(
  uid: string,
  residenceIds: string[],
  lotIds: string[]
): Promise<UserEmail[]> {
  const byId = new Map<string, UserEmail>()
  await Promise.all(
    residenceIds.map(async (residenceId) => {
      const mail = collection(db, "residences", residenceId, "mail")
      const queries = [query(mail, where("senderUid", "==", uid))]
      for (let i = 0; i < lotIds.length; i += 30) {
        queries.push(query(mail, where("lotId", "in", lotIds.slice(i, i + 30))))
      }
      for (const q of queries) {
        try {
          const snap = await getDocs(q)
          for (const docSnap of snap.docs) {
            const email = fromResidenceMail(residenceId, uid, docSnap)
            byId.set(email.id, email)
          }
        } catch (err) {
          console.warn(`fetchResidenceThreads: ${residenceId} ignorée`, err)
        }
      }
    })
  )
  return [...byId.values()]
}

export async function sendUserEmail(uid: string, subject: string, body: string): Promise<boolean> {
  const call = httpsCallable<{ uid: string; subject: string; body: string }, { success: boolean; error: string | null }>(
    functions,
    "send_user_email"
  )
  const result = await call({ uid, subject, body })
  if (!result.data.success) throw new Error(result.data.error ?? "Envoi impossible")
  return true
}
