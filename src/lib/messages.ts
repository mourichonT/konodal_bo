import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { db, functions } from "@/firebase"

// Page Messages (boîte de réception à la Outlook) : les mails écrits par les
// résidents à leur syndic depuis l'app et les réponses du syndic rapatriées
// par IMAP, tous dans residences/{id}/mail (cf. send_email_on_create et
// _store_emails_from_selected_folder, functions_python/main.py). Les mails
// envoyés depuis le BO (ordres d'intervention) n'y figurent pas : ni
// senderUid ni from. Filtre Nodo (nodo_mail.py) : statut nodo_pending /
// nodo_answered et champ nodo (décision, réponse, raison).

// Derniers mails lus par résidence : la page couvre l'activité récente.
export const MAILBOX_LIMIT = 150

export type MailStatus =
  | "nodo_pending"
  | "nodo_answered"
  | "nodo_forwarded"
  | "resident_forwarded"
  | "sent"
  | "sending"
  | "error"
  | "reply"
  | "outgoing"

// Catégories du tri de Nodo (MAIL_CATEGORIES, functions_python/nodo_mail.py).
export const MAIL_CATEGORY_KEYS = [
  "travaux",
  "sinistre",
  "charges",
  "ag",
  "nuisances",
  "administratif",
  "autre",
] as const
export type MailCategory = (typeof MAIL_CATEGORY_KEYS)[number]

export type MailNodo = {
  decision: "answer" | "forward" | null
  // Classement du message par Nodo : simple information ou demande au syndic.
  nature: "information" | "demande" | null
  // Tri du message par Nodo (catégorie, urgence) : seulement quand Nodo l'a lu.
  category: MailCategory | null
  urgent: boolean
  answer: string
  reason: string
  at: Date | null
  forwardedByResidentAt: Date | null
}

export type ResidenceMail = {
  // `${residenceId}:${id}`
  key: string
  id: string
  residenceId: string
  // Message d'un résident au syndic, ou réponse du syndic (IMAP).
  kind: "resident" | "syndic"
  subject: string
  lotLabel: string | null
  lotId: string | null
  residentUid: string | null
  from: string | null
  to: string[]
  text: string
  html: string | null
  date: Date | null
  status: MailStatus
  nodo: MailNodo | null
  error: string | null
  // Réponse écrite depuis le BO (reply_to_resident_mail) : auteur, et copie
  // envoyée à la boîte mail du syndic.
  repliedBy: { uid: string; name: string } | null
  // Objet libre choisi par le résident (app), repris par les réponses.
  topic: string | null
  // Message du résident auquel une réponse se rattache (BO, relève IMAP).
  repliedTo: string | null
  // Nouveau message d'un résident pas encore ouvert par l'agence (posé par
  // send_email_on_create, repassé à false à l'ouverture dans le BO).
  unreadByAgency: boolean
  agencyCopy: { to: string; success: boolean; error: string | null } | null
}

function toDate(value: unknown): Date | null {
  return value && typeof (value as Timestamp).toDate === "function" ? (value as Timestamp).toDate() : null
}

// Texte saisi dans l'app (brut) ou réponse du syndic parfois en HTML.
function looksLikeHtml(value: string): boolean {
  return /<(html|table|body|div|p|br)[\s/>]/i.test(value)
}

// Objet technique « Vous avez un message pour la residence X - lot A 12 » :
// seul le lot sert à l'affichage.
function lotFromSubject(subject: string): string | null {
  const index = subject.lastIndexOf(" - lot ")
  return index >= 0 ? subject.slice(index + 7).trim() || null : null
}

function toMail(residenceId: string, snap: QueryDocumentSnapshot<DocumentData>): ResidenceMail | null {
  const d = snap.data()
  if (!d.senderUid && !d.from) return null
  const message = (d.message as Record<string, string> | undefined) ?? {}
  const content = message.html ?? message.text ?? ""
  const subject = message.subject ?? ""
  const rawNodo = d.nodo as Record<string, unknown> | undefined
  const nodo: MailNodo | null =
    rawNodo || d.status === "nodo_pending" || d.status === "nodo_answered"
      ? {
          decision: (rawNodo?.decision as MailNodo["decision"]) ?? null,
          nature: (rawNodo?.nature as MailNodo["nature"]) ?? null,
          answer: String(rawNodo?.answer ?? ""),
          reason: String(rawNodo?.reason ?? ""),
          at: toDate(rawNodo?.at),
          forwardedByResidentAt: toDate(rawNodo?.forwardedByResidentAt),
          category: (MAIL_CATEGORY_KEYS as readonly string[]).includes(String(rawNodo?.category))
            ? (rawNodo?.category as MailCategory)
            : null,
          urgent: rawNodo?.urgent === true,
        }
      : null
  const status: MailStatus = d.from
    ? d.startedBySyndic
      ? "outgoing"
      : "reply"
    : d.status === "nodo_pending"
      ? "nodo_pending"
      : d.status === "nodo_answered"
        ? "nodo_answered"
        : nodo?.forwardedByResidentAt
          ? "resident_forwarded"
          : d.status === "error"
            ? "error"
            : nodo?.decision === "forward"
              ? "nodo_forwarded"
              : d.status === "sent"
                ? "sent"
                : "sending"
  return {
    key: `${residenceId}:${snap.id}`,
    id: snap.id,
    residenceId,
    kind: d.from ? "syndic" : "resident",
    subject,
    lotLabel: lotFromSubject(subject),
    lotId: (d.lotId as string | undefined) ?? null,
    residentUid: (d.residentUid as string | undefined) ?? (d.senderUid as string | undefined) ?? null,
    from: (d.from as string | undefined) ?? null,
    to: Array.isArray(d.to) ? (d.to as string[]) : typeof d.to === "string" ? [d.to] : [],
    text: looksLikeHtml(content) ? "" : content,
    html: looksLikeHtml(content) ? content : null,
    date: toDate(d.startTime),
    status,
    nodo,
    error: (d.error as string | undefined) ?? null,
    repliedBy: (d.repliedBy as ResidenceMail["repliedBy"] | undefined) ?? null,
    topic: typeof d.topic === "string" && d.topic.trim() ? d.topic.trim() : null,
    repliedTo: (d.repliedTo as string | undefined) ?? null,
    unreadByAgency: d.unreadByAgency === true,
    agencyCopy: (d.agencyCopy as ResidenceMail["agencyCopy"] | undefined) ?? null,
  }
}

export function subscribeToResidenceMailbox(
  residenceId: string,
  onData: (mails: ResidenceMail[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "residences", residenceId, "mail"), orderBy("startTime", "desc"), limit(MAILBOX_LIMIT)),
    (snap) => onData(snap.docs.map((d) => toMail(residenceId, d)).filter((m): m is ResidenceMail => !!m)),
    onError
  )
}

// Conversation d'un mail - même règle que l'app et le serveur
// (_conversation_key, functions_python/main.py) : même résident, même fil de
// lot (message.subject), puis une réponse (repliedTo) suit son message
// d'origine ; sinon l'objet (topic, sans casse ni espaces en bord) ; sinon le
// mail seul (anciens mails). byKey : mails chargés, par `${residenceId}:${id}`.
export function conversationKey(mail: ResidenceMail, byKey: Map<string, ResidenceMail>): string {
  const base = [mail.residenceId, mail.residentUid ?? "", mail.subject].join("|")
  if (mail.repliedTo) {
    const origin = byKey.get(`${mail.residenceId}:${mail.repliedTo}`)
    if (origin && !origin.repliedTo) return conversationKey(origin, byKey)
    return `${base}|id:${mail.repliedTo}`
  }
  const topic = mail.topic?.trim().toLowerCase()
  return topic ? `${base}|topic:${topic}` : `${base}|id:${mail.id}`
}

// Mail passé par le filtre de Nodo (onglet Nodo).
export function isNodoMail(mail: ResidenceMail): boolean {
  return mail.nodo !== null
}

// Corps lisible en texte (aperçu de la liste, recherche).
export function mailPlainText(mail: ResidenceMail): string {
  if (mail.text) return mail.text
  return (mail.html ?? "")
    .replace(/<(br|\/p|\/div)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .trim()
}

// Réponse au message d'un résident depuis le BO (reply_to_resident_mail) :
// affichée dans l'app du résident ; copie dans la boîte mail du syndic,
// rangée dans le fil du message (copied : envoi de la copie réussi).
export async function replyToResidentMail(
  mail: ResidenceMail,
  text: string
): Promise<{ mailId: string; copied: boolean; copyTo: string }> {
  const call = httpsCallable<
    { residenceId: string; mailId: string; text: string },
    { mailId: string; copied: boolean; copyTo: string }
  >(functions, "reply_to_resident_mail")
  return (await call({ residenceId: mail.residenceId, mailId: mail.id, text })).data
}

// « Nouveau message » : le syndic écrit le premier à un résident
// (write_to_resident) ; copie à l'adresse du compte qui écrit.
export async function writeToResident(input: {
  residenceId: string
  lotId: string
  residentUid: string
  topic: string
  text: string
}): Promise<{ mailId: string; copied: boolean; copyTo: string }> {
  const call = httpsCallable<typeof input, { mailId: string; copied: boolean; copyTo: string }>(
    functions,
    "write_to_resident"
  )
  return (await call(input)).data
}

// Pastille « Messages » du menu : nombre de messages de résidents non lus
// par l'agence dans une résidence.
export function subscribeToUnreadMailCount(
  residenceId: string,
  onCount: (count: number) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "residences", residenceId, "mail"), where("unreadByAgency", "==", true)),
    (snap) => onCount(snap.size),
    onError
  )
}

// Ouverture par l'agence : lus pour toute l'agence (boîte partagée).
export async function markMailsRead(mails: ResidenceMail[]): Promise<void> {
  await Promise.all(
    mails
      .filter((mail) => mail.unreadByAgency)
      .map((mail) => updateDoc(doc(db, "residences", mail.residenceId, "mail", mail.id), { unreadByAgency: false }))
  )
}
