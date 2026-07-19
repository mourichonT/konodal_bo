import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type DocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore"
import { getDownloadURL, ref, uploadBytes } from "firebase/storage"
import { db, storage } from "@/firebase"
import type { AdCampaign, AdCampaignInput } from "@/types/adCampaign"

const adCampaignsCollection = collection(db, "adCampaigns")

export const CAMPAIGN_STATUS_BADGE_CLASS: Record<string, string> = {
  "Dates à renseigner": "border-transparent bg-red-100 text-red-800",
  Programmée: "border-transparent bg-sky-100 text-sky-800",
  Active: "border-transparent bg-emerald-100 text-emerald-800",
  "En attente": "border-transparent bg-amber-100 text-amber-800",
  Terminée: "border-transparent bg-slate-100 text-slate-600",
}

// Statut purement dérivé de la période + de `active` (écrit par la Cloud
// Function de réconciliation, jamais par ce BO) - "En attente" signifie que
// la campagne est dans sa période mais que son (ou l'un de ses) département
// ciblé a déjà 3 campagnes actives.
export function campaignStatus(campaign: AdCampaign, today: string): string {
  if (!campaign.startDate || !campaign.endDate) return "Dates à renseigner"
  if (today < campaign.startDate) return "Programmée"
  if (today > campaign.endDate) return "Terminée"
  return campaign.active ? "Active" : "En attente"
}

export type CampaignTimeConsumed = {
  elapsedDays: number
  totalDays: number
  percent: number
}

// Jours écoulés depuis startDate, bornés entre 0 (pas encore démarrée) et
// totalDays (terminée) - les deux bornes incluses dans le décompte (une
// campagne du même jour au même jour dure 1 jour, pas 0).
export function campaignTimeConsumed(campaign: AdCampaign, today: string): CampaignTimeConsumed | null {
  if (!campaign.startDate || !campaign.endDate) return null
  const msPerDay = 24 * 60 * 60 * 1000
  const start = new Date(`${campaign.startDate}T00:00:00`).getTime()
  const end = new Date(`${campaign.endDate}T00:00:00`).getTime()
  const now = new Date(`${today}T00:00:00`).getTime()
  const totalDays = Math.max(1, Math.round((end - start) / msPerDay) + 1)
  const elapsedDays = Math.min(totalDays, Math.max(0, Math.round((now - start) / msPerDay) + 1))
  return { elapsedDays, totalDays, percent: Math.round((elapsedDays / totalDays) * 100) }
}

function toDateOrNull(value: unknown): Date | null {
  return value && typeof (value as { toDate?: unknown }).toDate === "function"
    ? (value as { toDate: () => Date }).toDate()
    : null
}

function toAdCampaign(snapshot: DocumentSnapshot<DocumentData>): AdCampaign {
  const data = snapshot.data() ?? {}
  return {
    id: snapshot.id,
    name: (data.name as string) ?? "",
    imageUrl: (data.imageUrl as string) ?? "",
    targetUrl: (data.targetUrl as string) ?? "",
    targetResidenceIds: Array.isArray(data.targetResidenceIds)
      ? (data.targetResidenceIds as string[])
      : [],
    startDate: (data.startDate as string) ?? "",
    endDate: (data.endDate as string) ?? "",
    createdAt: toDateOrNull(data.createdAt)?.toISOString() ?? null,
    targetDepartments: Array.isArray(data.targetDepartments)
      ? (data.targetDepartments as string[])
      : [],
    active: (data.active as boolean) ?? false,
    impressionCount: (data.impressionCount as number) ?? 0,
    clickCount: (data.clickCount as number) ?? 0,
    impressionsByResidence: (data.impressionsByResidence as Record<string, number>) ?? {},
    clicksByResidence: (data.clicksByResidence as Record<string, number>) ?? {},
  }
}

// Lecture de TOUTES les campagnes (actives ou non) - réservé à isSuperAdmin
// côté firestore.rules, distinct de la lecture app mobile (limitée à
// active == true, filtrée sur la résidence).
export function subscribeToAdCampaigns(
  onData: (campaigns: AdCampaign[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    adCampaignsCollection,
    (snapshot) => onData(snapshot.docs.map(toAdCampaign)),
    onError
  )
}

export function subscribeToAdCampaign(
  id: string,
  onData: (campaign: AdCampaign | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(adCampaignsCollection, id),
    (snapshot) => onData(snapshot.exists() ? toAdCampaign(snapshot) : null),
    onError
  )
}

export type AdCampaignEvent = {
  id: string
  uid: string
  residenceId: string
  // "Propriétaire" | "Locataire" | "Inconnu" - dérivé du lot préféré côté
  // app (idProprietaire/idLocataire), pas un champ dédié sur le compte.
  statutResident: string
  timestamp: Date | null
}

function toAdCampaignEvent(snapshot: DocumentSnapshot<DocumentData>): AdCampaignEvent {
  const data = snapshot.data() ?? {}
  return {
    id: snapshot.id,
    uid: (data.uid as string) ?? "",
    residenceId: (data.residenceId as string) ?? "",
    statutResident: (data.statutResident as string) || "Inconnu",
    timestamp: toDateOrNull(data.timestamp),
  }
}

// Journal détaillé (un document par impression/clic, cf. functions_python/
// main.py) - sert au graphique "dans le temps" (jour/mois/année) de
// AdCampaignDetailPage, distinct des compteurs agrégés impressionCount/
// impressionsByResidence utilisés pour les KPI et la répartition par région.
export function subscribeToAdCampaignImpressions(
  campaignId: string,
  onData: (events: AdCampaignEvent[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(adCampaignsCollection, campaignId, "impressions"),
    (snapshot) => onData(snapshot.docs.map(toAdCampaignEvent)),
    onError
  )
}

export function subscribeToAdCampaignClicks(
  campaignId: string,
  onData: (events: AdCampaignEvent[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(adCampaignsCollection, campaignId, "clicks"),
    (snapshot) => onData(snapshot.docs.map(toAdCampaignEvent)),
    onError
  )
}

// `active` n'est jamais écrit ici : c'est la Cloud Function de réconciliation
// (reconcile_ad_campaigns_*, functions_python/main.py) qui l'active/désactive
// selon startDate/endDate et le quota de 3 campagnes actives par département
// - forcé à false à la création, corrigé au premier passage de la fonction
// si la période est déjà en cours et qu'un emplacement est libre.
export async function createAdCampaign(input: AdCampaignInput) {
  await addDoc(adCampaignsCollection, {
    ...input,
    active: false,
    targetDepartments: [],
    impressionCount: 0,
    clickCount: 0,
    createdAt: serverTimestamp(),
  })
}

export async function updateAdCampaign(id: string, input: AdCampaignInput) {
  await updateDoc(doc(adCampaignsCollection, id), { ...input })
}

export async function deleteAdCampaign(id: string) {
  await deleteDoc(doc(adCampaignsCollection, id))
}

// Upload direct côté client (storage.rules autorise tout utilisateur
// connecté) - l'app mobile affiche imageUrl via Image.network, donc on
// stocke bien l'URL de téléchargement complète, pas un chemin Storage brut.
export async function uploadAdCampaignImage(file: File): Promise<string> {
  const path = `adCampaigns/${crypto.randomUUID()}_${file.name}`
  const fileRef = ref(storage, path)
  await uploadBytes(fileRef, file)
  return getDownloadURL(fileRef)
}
