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

export function createProMission(input: {
  residenceId: string
  sinistreId: string
  contactId: string
  message?: string
  urgence?: boolean
  contactCsMemberIds?: string[]
}): Promise<{ missionId: string }> {
  return call("pro_create_mission", input)
}

export function cancelProMission(missionId: string, reason: string): Promise<{ statut: string }> {
  return call("pro_cancel_mission", { missionId, reason })
}

export type ProMissionStatut = "proposee" | "acceptee" | "refusee" | "planifiee" | "realisee" | "annulee"

export const PRO_MISSION_LABELS: Record<ProMissionStatut, string> = {
  proposee: "Proposée",
  acceptee: "Acceptée",
  refusee: "Refusée",
  planifiee: "Planifiée",
  realisee: "Réalisée",
  annulee: "Annulée",
}

export type ProMission = {
  id: string
  numero: string
  devisStatut: "envoye" | "accepte" | "refuse" | null
  factureStatut: "envoyee" | "bon_a_payer" | "payee" | null
  unreadSyndic: number
  statut: ProMissionStatut
  contactName: string
  entrepriseId: string
  eventDate: Date | null
  refusalReason: string
  createdByName: string
  createdAt: Date | null
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
  return onSnapshot(
    q,
    (snap) => {
      const missions = snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          numero: (data.numero as string) ?? "",
          devisStatut: (data.devisStatut as ProMission["devisStatut"]) ?? null,
          factureStatut: (data.factureStatut as ProMission["factureStatut"]) ?? null,
          unreadSyndic: (data.unread?.syndic as number) ?? 0,
          statut: (data.statut as ProMissionStatut) ?? "proposee",
          contactName: (data.contactName as string) ?? "",
          entrepriseId: (data.entrepriseId as string) ?? "",
          eventDate: data.eventDate?.toDate?.() ?? null,
          refusalReason: (data.refusalReason as string) ?? "",
          createdByName: (data.createdByName as string) ?? "",
          createdAt: data.createdAt?.toDate?.() ?? null,
        }
      })
      missions.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
      onData(missions)
    },
    (error) => onError?.(error)
  )
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

export type ProMissionFinance = {
  devisTTC: number | null
  factureNumero: string | null
  factureTTC: number | null
  factureStatut: "envoyee" | "bon_a_payer" | "payee" | null
  echeance: Date | null
  paidAt: Date | null
}

export function subscribeToMissionFinance(missionId: string, onData: (f: ProMissionFinance | null) => void): Unsubscribe {
  return onSnapshot(doc(db, "missionFinances", missionId), (snap) => {
    if (!snap.exists()) return onData(null)
    const x = snap.data()
    onData({
      devisTTC: (x.devisTTC as number) ?? null,
      factureNumero: (x.factureNumero as string) ?? null,
      factureTTC: (x.factureTTC as number) ?? null,
      factureStatut: (x.factureStatut as ProMissionFinance["factureStatut"]) ?? null,
      echeance: x.echeance?.toDate?.() ?? null,
      paidAt: x.paidAt?.toDate?.() ?? null,
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
