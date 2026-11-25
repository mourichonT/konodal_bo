import { httpsCallable } from "firebase/functions"
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore"
import { db, functions } from "@/firebase"
import type { ProConformite } from "@/types/contact"

// Konodal Pro (pro.konodal.com), webapp des artisans et prestataires
// (functions_python/pro.py, 2026-11-20) : carnet du syndic (recherche,
// rattachement, invitation), missions confiées depuis un sinistre, relecture
// des pièces de conformité (superAdmin).

export type ProPublicCard = {
  entrepriseId: string
  ref: string
  raisonSociale: string
  siret: string
  city: string
  metiers: string[]
  departements: string[]
  conformite: ProConformite
}

export type ProFindResult = ({ found: true; inCarnet: boolean; contactIds: string[] } & ProPublicCard) | { found: false }

async function call<Req, Res>(name: string, data: Req, timeout = 70_000): Promise<Res> {
  const fn = httpsCallable<Req, Res>(functions, name, { timeout })
  return (await fn(data)).data
}

// Recherche par référence (« P7K2QX9 »), SIRET ou lien de la fiche
// (pro.konodal.com/f/{ref}, ouvert par le QR code ou reçu par mail).
export function findProEntreprise(query: string): Promise<ProFindResult> {
  return call<{ query: string }, ProFindResult>("pro_find_entreprise", { query })
}

// Ajoute l'entreprise au carnet : relie un contact existant, ou en crée un
// à partir de sa fiche ; rattache aux résidences choisies.
export function linkProContact(
  entrepriseId: string,
  options: { contactId?: string; residenceIds?: string[] } = {}
): Promise<{ contactId: string; residenceIds: string[] }> {
  return call("pro_link_contact", { entrepriseId, ...options })
}

// Invitation par mail à créer un compte Konodal Pro (lien valable 30 jours).
export function inviteProContact(contactId: string, email?: string): Promise<{ ok: boolean; sent?: boolean; alreadySent?: boolean }> {
  return call("pro_invite_contact", { contactId, ...(email ? { email } : {}) })
}

// Demande d'intervention (formulaire d'intervention du BO, 2026-11-21) :
// prestataire Konodal Pro (mission dans sa webapp, depuis un sinistre) ou
// tout autre contact ayant un mail (demande par mail avec un lien de
// partage, avec ou sans sinistre) - le serveur choisit le canal. Le
// prestataire accepte ou refuse avant repondreAvant, puis fixe lui-même la
// date et le créneau : l'intervention n'est publiée qu'à ce moment-là.
export type InterventionDemandInput = {
  residenceId: string
  sinistreId?: string
  contactId: string
  repondreAvant: string
  title: string
  description?: string
  pathImage?: string
  locationElement?: string
  locationFloor?: string
  audience?: "all" | "proprietaires"
  contactCsMemberIds?: string[]
  message?: string
  urgence?: boolean
}

export function createProMission(
  input: InterventionDemandInput
): Promise<{ missionId: string; canal: ProMissionCanal; numero: string; repondreAvant: string }> {
  // Adresse de ce BO, pour le lien envoyé au prestataire hors prod (le
  // serveur ne l'accepte que pour des adresses locales connues).
  const linkBase = `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/$/, "")
  return call("pro_create_mission", { ...input, linkBase })
}

export function cancelProMission(missionId: string, reason: string): Promise<{ statut: string }> {
  return call("pro_cancel_mission", { missionId, reason })
}

export type ProMissionStatut =
  | "proposee"
  | "acceptee"
  | "refusee"
  | "sans_reponse"
  | "planifiee"
  | "realisee"
  | "annulee"

export const PRO_MISSION_LABELS: Record<ProMissionStatut, string> = {
  proposee: "En attente de réponse",
  acceptee: "Acceptée",
  refusee: "Refusée",
  sans_reponse: "Sans réponse",
  planifiee: "Planifiée",
  realisee: "Réalisée",
  annulee: "Annulée",
}

// « pro » : entreprise Konodal Pro ; « lien » : prestataire sans compte,
// par mail et lien de partage.
export type ProMissionCanal = "pro" | "lien"

export type ProMission = {
  id: string
  numero: string
  canal: ProMissionCanal
  devisStatut: "envoye" | "accepte" | "refuse" | null
  factureStatut: "envoyee" | "bon_a_payer" | "payee" | null
  unreadSyndic: number
  statut: ProMissionStatut
  title: string
  contactName: string
  contactMail: string
  entrepriseId: string
  residenceId: string
  sinistreId: string
  repondreAvant: Date | null
  eventDate: Date | null
  eventEnd: Date | null
  currentEventId: string
  refusalReason: string
  cancelReason: string
  createdByName: string
  createdAt: Date | null
  updatedAt: Date | null
}

// En attente de réponse et dans le délai : bloque toute autre demande sur
// le même sinistre (règle du serveur, pro_create_mission).
export function isAwaitingResponse(m: ProMission, now = new Date()): boolean {
  return m.statut === "proposee" && (!m.repondreAvant || m.repondreAvant > now)
}

const formatDateTime = (date: Date) => date.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })
const formatTime = (date: Date) => date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })

// Ce que la demande attend ou ce qui s'est passé, en une ligne.
export function missionStatusLine(m: ProMission): string | null {
  if (m.statut === "proposee" && m.repondreAvant) {
    return m.repondreAvant > new Date()
      ? `Réponse attendue avant le ${formatDateTime(m.repondreAvant)}`
      : `Délai de réponse dépassé (${formatDateTime(m.repondreAvant)})`
  }
  if (m.statut === "sans_reponse") {
    const deadline = m.repondreAvant ? ` avant le ${formatDateTime(m.repondreAvant)}` : ""
    return `Pas de réponse${deadline} : vous pouvez mandater un autre prestataire`
  }
  if (m.statut === "refusee") return `Refusée${m.refusalReason ? ` : ${m.refusalReason}` : ""}`
  if (m.statut === "annulee") return `Annulée${m.cancelReason ? ` : ${m.cancelReason}` : ""}`
  if (m.eventDate) {
    return `Passage le ${formatDateTime(m.eventDate)}${m.eventEnd ? ` – ${formatTime(m.eventEnd)}` : ""}`
  }
  return null
}

function toProMission(d: QueryDocumentSnapshot<DocumentData>): ProMission {
  const data = d.data()
  return {
    id: d.id,
    numero: (data.numero as string) ?? "",
    canal: data.canal === "lien" ? "lien" : "pro",
    devisStatut: (data.devisStatut as ProMission["devisStatut"]) ?? null,
    factureStatut: (data.factureStatut as ProMission["factureStatut"]) ?? null,
    unreadSyndic: (data.unread?.syndic as number) ?? 0,
    statut: (data.statut as ProMissionStatut) ?? "proposee",
    title: (data.intervention?.title as string) || (data.sinistre?.title as string) || "",
    contactName: (data.contactName as string) ?? "",
    contactMail: (data.contactMail as string) ?? "",
    entrepriseId: (data.entrepriseId as string) ?? "",
    residenceId: (data.residenceId as string) ?? "",
    sinistreId: (data.sinistreId as string) ?? "",
    repondreAvant: data.repondreAvant?.toDate?.() ?? null,
    eventDate: data.eventDate?.toDate?.() ?? null,
    eventEnd: data.eventEnd?.toDate?.() ?? null,
    currentEventId: (data.currentEventId as string) ?? "",
    refusalReason: (data.refusalReason as string) ?? "",
    cancelReason: (data.cancelReason as string) ?? "",
    createdByName: (data.createdByName as string) ?? "",
    createdAt: data.createdAt?.toDate?.() ?? null,
    updatedAt: data.updatedAt?.toDate?.() ?? null,
  }
}

function subscribeToMissions(
  q: Query<DocumentData>,
  onData: (missions: ProMission[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    q,
    (snap) => {
      const missions = snap.docs.map(toProMission)
      missions.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
      onData(missions)
    },
    (error) => onError?.(error)
  )
}

// Missions d'un sinistre (lecture permise au syndic de la résidence,
// firestore.rules : requête filtrée par residenceId).
export function subscribeToSinistreMissions(
  residenceId: string,
  sinistreId: string,
  onData: (missions: ProMission[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, "missions"),
    where("residenceId", "==", residenceId),
    where("sinistreId", "==", sinistreId)
  )
  return subscribeToMissions(q, onData, onError)
}

// Toutes les demandes d'une résidence (page Interventions : demandes en
// attente de réponse, refusées ou sans réponse).
export function subscribeToResidenceMissions(
  residenceId: string,
  onData: (missions: ProMission[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return subscribeToMissions(query(collection(db, "missions"), where("residenceId", "==", residenceId)), onData, onError)
}

// --- Devis, facture et fil d'une mission (côté syndic) ---

export type ProDevisLigne = { designation: string; qte: number; unite: string; puHT: number; tva: number; totalHT: number }

export type ProDevis = {
  id: string
  numero: string
  objet: string
  statut: "brouillon" | "envoye" | "accepte" | "refuse"
  lignes: ProDevisLigne[]
  totalHT: number
  tva: Record<string, number>
  totalTTC: number
  sentAt: Date | null
  refusalReason: string
}

// Devis envoyés d'une mission (le brouillon reste chez l'entreprise : il
// n'est pas lisible tant qu'il n'est pas transmis… mais les règles le
// laissent lire au syndic ; on ne montre que les devis envoyés).
export function subscribeToMissionDevis(missionId: string, onData: (devis: ProDevis[]) => void): Unsubscribe {
  return onSnapshot(collection(db, "missions", missionId, "devis"), (snap) => {
    const list = snap.docs
      .map((d) => {
        const x = d.data()
        return {
          id: d.id,
          numero: (x.numero as string) ?? "",
          objet: (x.objet as string) ?? "",
          statut: (x.statut as ProDevis["statut"]) ?? "brouillon",
          lignes: (x.lignes as ProDevisLigne[]) ?? [],
          totalHT: (x.totalHT as number) ?? 0,
          tva: (x.tva as Record<string, number>) ?? {},
          totalTTC: (x.totalTTC as number) ?? 0,
          sentAt: x.sentAt?.toDate?.() ?? null,
          refusalReason: (x.refusalReason as string) ?? "",
        }
      })
      .filter((d) => d.statut !== "brouillon")
    list.sort((a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0))
    onData(list)
  })
}

export function decideProDevis(missionId: string, devisId: string, accept: boolean, reason = ""): Promise<unknown> {
  return call("pro_decide_devis", { missionId, devisId, accept, reason })
}

// Facture annulée de la mission et l'avoir qui l'annule (pro_create_avoir).
export type ProAvoir = {
  factureId: string
  factureNumero: string
  avoirId: string
  avoirNumero: string
  totalTTC: number | null
}

export type ProMissionFinance = {
  devisTTC: number | null
  factureId: string | null
  factureNumero: string | null
  factureTTC: number | null
  factureStatut: "envoyee" | "bon_a_payer" | "payee" | null
  echeance: Date | null
  paidAt: Date | null
  // PDF reçu par mail (pro_envoyer_facture), dernière relance du prestataire.
  factureEnvoyeeAt: Date | null
  factureRelanceeAt: Date | null
  avoirs: ProAvoir[]
}

export function subscribeToMissionFinance(missionId: string, onData: (f: ProMissionFinance | null) => void): Unsubscribe {
  return onSnapshot(doc(db, "missionFinances", missionId), (snap) => {
    if (!snap.exists()) return onData(null)
    const x = snap.data()
    onData({
      devisTTC: (x.devisTTC as number) ?? null,
      factureId: (x.factureId as string) ?? null,
      factureNumero: (x.factureNumero as string) ?? null,
      factureTTC: (x.factureTTC as number) ?? null,
      factureStatut: (x.factureStatut as ProMissionFinance["factureStatut"]) ?? null,
      echeance: x.echeance?.toDate?.() ?? null,
      paidAt: x.paidAt?.toDate?.() ?? null,
      factureEnvoyeeAt: x.factureEnvoyeeAt?.toDate?.() ?? null,
      factureRelanceeAt: x.factureRelanceeAt?.toDate?.() ?? null,
      avoirs: ((x.avoirs as Record<string, unknown>[]) ?? []).map((a) => ({
        factureId: String(a.factureId ?? ""),
        factureNumero: String(a.factureNumero ?? ""),
        avoirId: String(a.avoirId ?? ""),
        avoirNumero: String(a.avoirNumero ?? ""),
        totalTTC: typeof a.totalTTC === "number" ? a.totalTTC : null,
      })),
    })
  })
}

// « Bon à payer » (le syndic valide le paiement) ou « Payée ».
export function setProFactureStatut(missionId: string, statut: "bon_a_payer" | "payee"): Promise<unknown> {
  return call("pro_update_facture_statut", { missionId, statut })
}

export type ProMessage = { id: string; side: "pro" | "syndic" | "system"; authorName: string; text: string; createdAt: Date | null }

export function subscribeToMissionMessages(missionId: string, onData: (m: ProMessage[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db, "missions", missionId, "messages"), orderBy("createdAt")), (snap) =>
    onData(
      snap.docs.map((d) => {
        const x = d.data()
        return {
          id: d.id,
          side: (x.side as ProMessage["side"]) ?? "system",
          authorName: (x.authorName as string) ?? "",
          text: (x.text as string) ?? "",
          createdAt: x.createdAt?.toDate?.() ?? null,
        }
      })
    )
  )
}

// Message du syndic à l'entreprise (seule écriture client du fil, règles
// Firestore : side « syndic » réservé au syndic de la résidence).
export function sendProMessage(missionId: string, uid: string, authorName: string, text: string): Promise<unknown> {
  return addDoc(collection(db, "missions", missionId, "messages"), {
    author: uid,
    authorName,
    side: "syndic",
    text,
    createdAt: serverTimestamp(),
  })
}

export function markProMissionRead(missionId: string): Promise<unknown> {
  return call("pro_mark_read", { missionId })
}

// --- Relecture des pièces (superAdmin) ---

export type ProDocumentToReview = {
  entrepriseId: string
  raisonSociale: string
  siren: string
  documentId: string
  type: string
  label: string
  fileName: string
  uploadedAt: string | null
  validFrom: string | null
  validUntil: string | null
  validUntilSource: string | null
  extraction: Record<string, unknown> | null
  checks: { sirenMatch: boolean | null; datesOk: boolean; typeMatch: boolean | null; suspectMarks: string[] } | null
  extractionError: string | null
}

export async function listProDocumentsToReview(): Promise<ProDocumentToReview[]> {
  const result = await call<Record<string, never>, { documents: ProDocumentToReview[] }>(
    "pro_list_documents_to_review",
    {}
  )
  return result.documents
}

export function reviewProDocument(input: {
  entrepriseId: string
  documentId: string
  decision: "valide" | "refuse"
  reason?: string
  validUntil?: string
}): Promise<{ conformite: ProConformite }> {
  return call("pro_review_document", input)
}

// Facture ou avoir de la mission, ouvert dans un nouvel onglet : le PDF que
// le syndic a reçu par mail (pro_get_facture_pdf).
export async function openProFacture(missionId: string, factureId: string): Promise<void> {
  const tab = window.open("", "_blank")
  try {
    const result = await call<
      { missionId: string; factureId: string },
      { fileName: string; contentType: string; data: string }
    >("pro_get_facture_pdf", { missionId, factureId })
    const bytes = Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0))
    const url = URL.createObjectURL(new Blob([bytes], { type: result.contentType }))
    if (tab) tab.location.href = url
    else window.open(url, "_blank")
  } catch (err) {
    tab?.close()
    throw err
  }
}

// Pièce ouverte dans un nouvel onglet (contenu renvoyé par la fonction :
// pas d'URL signée ni de lien permanent, cf. pro_get_document).
export async function openProDocument(entrepriseId: string, documentId: string): Promise<void> {
  const tab = window.open("", "_blank")
  const result = await call<
    { entrepriseId: string; documentId: string },
    { fileName: string; contentType: string; data: string }
  >("pro_get_document", { entrepriseId, documentId })
  const bytes = Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: result.contentType }))
  if (tab) tab.location.href = url
  else window.open(url, "_blank")
}
