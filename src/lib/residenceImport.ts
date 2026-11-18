import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore"
import { ref, uploadBytesResumable } from "firebase/storage"
import { db, storage } from "@/firebase"
import { createResidence } from "@/lib/residences"
import { importLots } from "@/lib/lots"
import {
  downloadLotRowsXlsx,
  validateLotImportRows,
  type LotImportValidation,
  type RawLotImportRow,
} from "@/lib/lotImportExport"
import { emptyAddress, type Address } from "@/types/residence"

// Création d'une résidence à partir de ses documents de copropriété, lus par
// Claude avec le connecteur Konodal (konodal_app/functions_python/
// residence_import_mcp.py, superAdmin seulement) :
//   1. le BO dépose les PDF (Storage residenceImports/{id}/) et crée
//      residenceImports/{id} en "waiting" ;
//   2. dans Claude, le connecteur lit les pages et écrit la proposition
//      (status "reading" puis "ready", step = avancement) ;
//   3. le superAdmin vérifie ici et crée la résidence avec les écritures
//      habituelles du BO (createResidence puis importLots) : "created".
// Le connecteur ne crée ni ne modifie jamais une résidence.

const COLLECTION = "residenceImports"

export type ResidenceImportStatus = "waiting" | "reading" | "ready" | "created"

export type ResidenceImportFile = { name: string; path: string; size: number }

// Lot de la proposition, déjà mis aux conventions Konodal par le serveur
// (residence_import_rules.py) : mêmes champs qu'une ligne d'import, plus la
// trace de la lecture.
export type ProposalLot = {
  refLot: string
  batiment: string
  lot: string
  typeLot: string
  isLinkable: boolean
  tantiemes: number
  etage: string
  numeroCommercial: string
  nature: string
  tantiemesEnLettres: string
  fichier: number | null
  page: number | null
  origine: string
  remarque: string
}

export type ProposalAddress = string | { adresse?: string; codePostal?: string; ville?: string }

export type ResidenceProposal = {
  residence: { nom?: string; adresse?: string; codePostal?: string; ville?: string; autresAdresses?: ProposalAddress[] }
  documents: { fichier?: number; titre?: string; date?: string; role?: string; utilisation?: string }[]
  baseDeclaree: number | null
  baseReglement: number | null
  lots: ProposalLot[]
  lotsReglement: ProposalLot[]
  lotsSupprimes: { ref?: string; motif?: string }[]
  hypotheses: string[]
  anomalies: string[]
  // Écarts restants détectés par le serveur (total, doublons…).
  ecarts: string[]
}

export type ProposalState = "actuel" | "reglement"

export type ResidenceImport = {
  id: string
  status: ResidenceImportStatus
  label: string
  files: ResidenceImportFile[]
  step?: string
  stepAt?: Timestamp
  createdAt?: Timestamp
  createdBy?: string
  proposal?: ResidenceProposal
  proposedAt?: Timestamp
  residenceId?: string
  selectedState?: ProposalState
  residenceCreatedAt?: Timestamp
}

// Même nettoyage que addRequestAttachment (residenceRequests.ts).
function safeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .slice(-80)
}

export const RESIDENCE_IMPORT_MAX_FILE_BYTES = 60 * 1024 * 1024

/** Dépose les PDF puis crée l'import ; renvoie son id. */
export async function createResidenceImport(
  label: string,
  files: File[],
  uid: string,
  onProgress?: (ratio: number) => void
): Promise<string> {
  const jobRef = doc(collection(db, COLLECTION))
  const total = files.reduce((sum, f) => sum + f.size, 0) || 1
  let done = 0
  const entries: ResidenceImportFile[] = []
  for (const [i, file] of files.entries()) {
    const path = `${COLLECTION}/${jobRef.id}/${i + 1}-${safeFileName(file.name)}`
    const task = uploadBytesResumable(ref(storage, path), file, { contentType: "application/pdf" })
    await new Promise<void>((resolve, reject) => {
      task.on(
        "state_changed",
        (s) => onProgress?.((done + s.bytesTransferred) / total),
        reject,
        () => resolve()
      )
    })
    done += file.size
    entries.push({ name: file.name, path, size: file.size })
  }
  await setDoc(jobRef, {
    status: "waiting",
    label: label.trim(),
    files: entries,
    createdAt: serverTimestamp(),
    createdBy: uid,
  })
  return jobRef.id
}

function toImport(id: string, data: Record<string, unknown>): ResidenceImport {
  return { ...(data as Omit<ResidenceImport, "id">), id }
}

export function subscribeToResidenceImport(
  id: string,
  onData: (job: ResidenceImport | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, COLLECTION, id),
    (snap) => onData(snap.exists() ? toImport(snap.id, snap.data()) : null),
    onError
  )
}

export function subscribeToRecentResidenceImports(
  onData: (jobs: ResidenceImport[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, COLLECTION), orderBy("createdAt", "desc"), limit(5)),
    (snapshot) => onData(snapshot.docs.map((d) => toImport(d.id, d.data()))),
    onError
  )
}

export function proposalLots(proposal: ResidenceProposal, state: ProposalState): ProposalLot[] {
  return state === "reglement" && proposal.lotsReglement?.length ? proposal.lotsReglement : proposal.lots
}

// Lignes d'import du BO (même chemin qu'un fichier .xlsx) : la validation et
// l'import des lots sont ceux de « Configuration des lots ».
export function proposalRows(lots: ProposalLot[]): RawLotImportRow[] {
  return lots.map((lot, i) => ({
    rowNumber: i + 2,
    batiment: lot.batiment,
    lot: lot.lot,
    refLot: lot.refLot,
    typeLot: lot.typeLot,
    isLinkableRaw: lot.isLinkable ? "Oui" : "Non",
    tantiemesRaw: String(lot.tantiemes),
    parentRefRaw: "",
    etageRaw: lot.etage,
  }))
}

export function validateProposalLots(lots: ProposalLot[]): LotImportValidation {
  return validateLotImportRows(proposalRows(lots), [], [])
}

export function downloadProposalXlsx(lots: ProposalLot[], label: string): Promise<void> {
  const name = safeFileName(label || "residence").replace(/\.+$/, "")
  return downloadLotRowsXlsx(
    lots.map((l) => [l.batiment, l.lot, l.refLot, l.typeLot, l.isLinkable ? "Oui" : "Non", l.tantiemes, "", l.etage]),
    `lots_${name}.xlsx`
  )
}

function alternateAddresses(proposal: ResidenceProposal, zipCode: string, city: string): Address[] {
  return (proposal.residence.autresAdresses ?? [])
    .map((a) =>
      typeof a === "string"
        ? { ...emptyAddress, street: a.trim(), zipCode, city }
        : { ...emptyAddress, street: (a.adresse ?? "").trim(), zipCode: a.codePostal || zipCode, city: a.ville || city }
    )
    .filter((a) => a.street)
}

/** Crée la résidence et ses lots, puis marque l'import comme créé. */
export async function createResidenceFromImport(
  job: ResidenceImport,
  state: ProposalState,
  residence: { name: string; street: string; zipCode: string; city: string }
): Promise<string> {
  const proposal = job.proposal
  if (!proposal) throw new Error("Aucune proposition sur cet import.")
  const validation = validateProposalLots(proposalLots(proposal, state))
  if (validation.errors.length > 0) throw new Error(`${validation.errors.length} lot(s) en erreur : à corriger d'abord.`)
  if (validation.toCreate.length === 0) throw new Error("Aucun lot à créer.")
  const residenceId = await createResidence({
    name: residence.name.trim(),
    address: { ...emptyAddress, street: residence.street.trim(), zipCode: residence.zipCode.trim(), city: residence.city.trim() },
    alternateAddresses: alternateAddresses(proposal, residence.zipCode.trim(), residence.city.trim()),
  })
  await importLots(residenceId, validation, 0, 0)
  await updateDoc(doc(db, COLLECTION, job.id), {
    status: "created",
    residenceId,
    selectedState: state,
    residenceCreatedAt: serverTimestamp(),
  })
  return residenceId
}
