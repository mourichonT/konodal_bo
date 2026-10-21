import {
  arrayUnion,
  collection,
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type Unsubscribe,
} from "firebase/firestore"
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage"
import { httpsCallable } from "firebase/functions"
import { auth, db, functions, storage } from "@/firebase"
import { visibilityOf } from "@/types/ged"
import type {
  GedDocument,
  GedFoundDocument,
  GedHistoryEntry,
  GedOverview,
  GedScope,
  GedVisibility,
} from "@/types/ged"

// GED (onglet Documents) : lecture et écriture des documents À LEUR PLACE,
// un seul enregistrement chacun (décision de l'utilisateur, 2026-10-21) :
// residences/{rid}/documents_copro/{id} (résidence, ou bâtiment avec le champ
// batiment), users/{uid}/lots/{lotId}/documents/{id} (un exemplaire par
// destinataire, même id - modèle de l'app). Drapeaux : adminOnly (non
// partagé : superAdmin seul, fichier dans adminDocuments/{rid}/, pas de
// lien), csOnly, batiment, tags, documentDate, deletedAt (corbeille),
// history (journal). Ce que le client ne peut pas faire est dans
// functions_python/ged.py : compteurs, recherche, déplacement du fichier au
// (dé)partage, notification.

function toDate(value: unknown): Date | null {
  if (value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate()
  }
  if (typeof value === "string") return new Date(value)
  return null
}

function historyOf(data: DocumentData): GedHistoryEntry[] {
  return ((data.history as Record<string, unknown>[] | undefined) ?? []).map((h) => ({
    at: toDate(h.at),
    by: (h.by as string) ?? "",
    byName: (h.byName as string) ?? "",
    action: (h.action as string) ?? "",
    detail: (h.detail as string | undefined) ?? undefined,
  }))
}

function fromData(
  data: DocumentData,
  base: { scope: GedScope; residenceId: string; lotId: string | null; id: string; holders: string[] }
): GedDocument {
  const recipients = [...new Set([...base.holders, ...((data.destinataire as string[] | undefined) ?? [])])]
  return {
    key: `${base.scope === "lot" ? `lot:${base.lotId}` : "copro"}:${base.residenceId}:${base.id}`,
    scope: base.scope,
    residenceId: base.residenceId,
    lotId: base.lotId,
    id: base.id,
    holders: base.holders,
    recipients,
    name: (data.name as string) ?? "",
    category: (data.type as string) ?? "",
    extension: ((data.extension as string) ?? "").toLowerCase(),
    timeStamp: toDate(data.timeStamp),
    documentDate: toDate(data.documentDate),
    adminOnly: data.adminOnly === true,
    csOnly: data.csOnly === true,
    ownersOnly: data.audience === "proprietaires",
    batiment: (data.batiment as string) ?? "",
    tags: (data.tags as string[] | undefined) ?? [],
    deletedAt: toDate(data.deletedAt),
    url: (data.documentPathRecto as string) ?? "",
    storagePath: (data.storagePath as string) ?? "",
    size: (data.size as number) ?? 0,
    contentType: (data.contentType as string) ?? "",
    history: historyOf(data),
  }
}

// Pièce d'identité, selfie, Kbis, justificatif de domicile (factures,
// catégorie « Justificatif », bail, attestation de propriété ou acte de vente
// déposés comme justificatif dans user/{uid}/justificatifDom/, Kbis dans
// user/{uid}/compagnyDoc/) : jamais dans la GED, pour personne (décision de
// l'utilisateur, 2026-10-21) - même règle que _is_personal de
// functions_python/ged.py et _lot_doc_allowed de nodo.py.
const PERSONAL_TYPES = new Set(["justificatif", "facture d'eau", "facture telephone", "facture d'electricite", "kbis"])
const PERSONAL_FOLDERS = new Set(["certification", "documentID", "justificatifDom", "compagnyDoc"])

function foldType(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/’/g, "'")
    .toLowerCase()
    .trim()
}

export function isPersonalDocument(data: DocumentData): boolean {
  if (PERSONAL_TYPES.has(foldType(data.type))) return true
  return [data.documentPathRecto, data.documentPathVerso, data.storagePath].some((value) => {
    const path = typeof value === "string" ? (value.startsWith("http") ? storagePathFromUrl(value) : value) : ""
    const segments = path.split("/")
    return segments.length > 2 && segments[0] === "user" && PERSONAL_FOLDERS.has(segments[2])
  })
}

// Document trouvé par le serveur -> document complet, lu à sa place.
export function foundToKey(found: GedFoundDocument): string {
  return `${found.scope === "lot" ? `lot:${found.lotId}` : "copro"}:${found.residenceId}:${found.id}`
}

function coproCollection(residenceId: string) {
  return collection(db, "residences", residenceId, "documents_copro")
}

function lotDocumentRef(uid: string, lotId: string, id: string) {
  return doc(db, "users", uid, "lots", lotId, "documents", id)
}

// Documents de résidence et de bâtiment d'une résidence (corbeille comprise :
// le filtrage se fait à l'affichage).
export function subscribeToResidenceGed(
  residenceId: string,
  onData: (documents: GedDocument[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    coproCollection(residenceId),
    (snapshot) =>
      onData(
        snapshot.docs.map((d) =>
          fromData(d.data(), {
            scope: d.data().batiment ? "building" : "residence",
            residenceId,
            lotId: null,
            id: d.id,
            holders: [],
          })
        )
      ),
    onError
  )
}

// Un seul document, en direct (fiche document) : son exemplaire de résidence,
// ou les exemplaires de ses détenteurs pour un document de lot.
export function subscribeToGedDocument(
  document: GedDocument,
  onData: (document: GedDocument | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  if (document.scope === "lot" && document.lotId) {
    return subscribeToLotGed(
      document.residenceId,
      document.lotId,
      document.holders,
      (documents) => onData(documents.find((d) => d.id === document.id) ?? null),
      onError
    )
  }
  return onSnapshot(
    doc(coproCollection(document.residenceId), document.id),
    (snap) =>
      onData(
        snap.exists()
          ? fromData(snap.data(), {
              scope: snap.data().batiment ? "building" : "residence",
              residenceId: document.residenceId,
              lotId: null,
              id: snap.id,
              holders: [],
            })
          : null
      ),
    onError
  )
}

// Documents d'un lot : un écouteur par occupant (propriétaires, locataires),
// exemplaires regroupés par id - même principe que subscribeToLotDocuments.
export function subscribeToLotGed(
  residenceId: string,
  lotId: string,
  occupants: string[],
  onData: (documents: GedDocument[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  if (occupants.length === 0) {
    onData([])
    return () => {}
  }
  const byUid = new Map<string, { id: string; data: DocumentData }[]>()
  const emit = () => {
    const merged = new Map<string, { data: DocumentData; holders: string[] }>()
    for (const [uid, docs] of byUid) {
      for (const d of docs) {
        const entry = merged.get(d.id) ?? { data: d.data, holders: [] }
        entry.holders.push(uid)
        merged.set(d.id, entry)
      }
    }
    onData(
      [...merged.entries()].map(([id, { data, holders }]) =>
        fromData(data, { scope: "lot", residenceId, lotId, id, holders })
      )
    )
  }
  const unsubscribes = occupants.map((uid) =>
    onSnapshot(
      collection(db, "users", uid, "lots", lotId, "documents"),
      (snapshot) => {
        byUid.set(
          uid,
          snapshot.docs.filter((d) => !isPersonalDocument(d.data())).map((d) => ({ id: d.id, data: d.data() }))
        )
        emit()
      },
      onError
    )
  )
  return () => unsubscribes.forEach((unsub) => unsub())
}

function actor(): { uid: string; name: string } {
  const user = auth.currentUser
  return { uid: user?.uid ?? "", name: user?.displayName || user?.email || "" }
}

function historyEntry(action: string, detail?: string) {
  const { uid, name } = actor()
  return { at: Timestamp.now(), by: uid, byName: name, action, ...(detail ? { detail } : {}) }
}

// Exemplaires Firestore d'un document : un pour la résidence, un par compte
// qui l'a dans sa liste pour un lot.
function recordRefs(document: GedDocument): DocumentReference[] {
  if (document.scope !== "lot" || !document.lotId) {
    return [doc(coproCollection(document.residenceId), document.id)]
  }
  return document.holders.map((uid) => lotDocumentRef(uid, document.lotId!, document.id))
}

async function updateRecords(document: GedDocument, data: Record<string, unknown>) {
  const batch = writeBatch(db)
  for (const recordRef of recordRefs(document)) batch.update(recordRef, data)
  await batch.commit()
}

function extensionOf(file: File): string {
  return file.name.includes(".") ? (file.name.split(".").pop() ?? "").toLowerCase() : ""
}

function baseName(file: File): string {
  return file.name.includes(".") ? file.name.slice(0, file.name.lastIndexOf(".")) : file.name
}

export type GedTarget =
  | { scope: "residence"; residenceId: string }
  | { scope: "building"; residenceId: string; batiment: string }
  | { scope: "lot"; residenceId: string; lotId: string; recipients: string[] }

// Date du document et étiquettes : jamais saisies à l'import, renseignées
// ensuite par Nodo en lisant le document (functions_python/nodo_documents.py).
export type GedUploadMeta = {
  name?: string
  category: string
  visibility: GedVisibility
}

export function targetLabel(target: GedTarget, lotLabel?: string): string {
  if (target.scope === "lot") return `Ajouté dans ${lotLabel ?? "le lot"}`
  if (target.scope === "building") return `Ajouté dans les documents du ${target.batiment}`
  return "Ajouté dans les documents de la résidence"
}

// Import d'un ou plusieurs fichiers dans un périmètre. Non partagé : fichier
// dans adminDocuments/{rid}/ et pas de lien sur la fiche (superAdmin seul).
// Document de lot partagé : un seul fichier dans documents_lot/{lotId}/ avec
// ses destinataires en métadonnées (storage.rules), et un exemplaire de la
// fiche par destinataire (modèle de l'app).
export async function uploadGedDocuments(
  target: GedTarget,
  files: File[],
  meta: GedUploadMeta,
  journalDetail: string
): Promise<number> {
  const internal = meta.visibility === "internal"
  if (target.scope === "lot" && target.recipients.length === 0) {
    throw new Error("Ce lot n'a ni propriétaire ni locataire : aucun destinataire pour le document.")
  }
  for (const file of files) {
    const extension = extensionOf(file)
    const suffix = `${crypto.randomUUID()}${extension ? `.${extension}` : ""}`
    const path = internal
      ? `adminDocuments/${target.residenceId}/${suffix}`
      : target.scope === "lot"
        ? `residences/${target.residenceId}/documents_lot/${target.lotId}/${suffix}`
        : `residences/${target.residenceId}/documents_copro/${suffix}`
    const fileRef = ref(storage, path)
    await uploadBytes(fileRef, file, {
      contentType: file.type || undefined,
      ...(target.scope === "lot" && !internal
        ? { customMetadata: { recipients: target.recipients.join(","), uploader: actor().uid } }
        : {}),
    })
    const url = internal ? "" : await getDownloadURL(fileRef)
    const record: Record<string, unknown> = {
      name: files.length === 1 && meta.name?.trim() ? meta.name.trim() : baseName(file),
      type: meta.category,
      documentPathRecto: url,
      extension,
      residenceId: target.residenceId,
      timeStamp: serverTimestamp(),
      size: file.size,
      contentType: file.type || "",
      history: [historyEntry(journalDetail)],
      ...(internal ? { adminOnly: true, storagePath: path } : {}),
      ...(meta.visibility === "cs" ? { csOnly: true } : {}),
      ...(meta.visibility === "owners" ? { audience: "proprietaires" } : {}),
      ...(target.scope === "building" ? { batiment: target.batiment } : {}),
    }
    if (target.scope === "lot") {
      const id = doc(collection(db, "users", target.recipients[0], "lots", target.lotId, "documents")).id
      const batch = writeBatch(db)
      for (const uid of target.recipients) {
        batch.set(lotDocumentRef(uid, target.lotId, id), {
          ...record,
          lotId: target.lotId,
          destinataire: target.recipients,
        })
      }
      await batch.commit()
    } else {
      await setDoc(doc(coproCollection(target.residenceId)), record)
    }
  }
  return files.length
}

export async function updateGedFields(
  document: GedDocument,
  patch: { name?: string; category?: string; tags?: string[]; documentDate?: Date | null },
  journal: string
) {
  const data: Record<string, unknown> = { history: arrayUnion(historyEntry(journal)) }
  if (patch.name !== undefined) data.name = patch.name
  if (patch.category !== undefined) data.type = patch.category
  if (patch.tags !== undefined) data.tags = patch.tags
  if (patch.documentDate !== undefined) {
    data.documentDate = patch.documentDate ? Timestamp.fromDate(patch.documentDate) : deleteField()
  }
  await updateRecords(document, data)
}

const VISIBILITY_NAMES: Record<GedVisibility, string> = {
  internal: "Non partagé",
  cs: "Conseil syndical",
  owners: "Propriétaires",
  shared: "Partagé",
}

// Changement de partage. Passer de non partagé à partagé (ou l'inverse)
// déplace le fichier côté serveur (ged_move_file, superAdmin) : un document
// non partagé n'a ni lien ni fichier lisible hors superAdmin.
export async function setGedVisibility(document: GedDocument, visibility: GedVisibility, options: { notify: boolean }) {
  const wasInternal = document.adminOnly
  const nowInternal = visibility === "internal"
  const data: Record<string, unknown> = {
    history: arrayUnion(
      historyEntry(`Partage : ${VISIBILITY_NAMES[visibilityOf(document)]} → ${VISIBILITY_NAMES[visibility]}`)
    ),
    csOnly: visibility === "cs" ? true : deleteField(),
    audience: visibility === "owners" ? "proprietaires" : deleteField(),
  }
  if (wasInternal !== nowInternal) {
    const move = httpsCallable<
      { residenceId: string; source: string; toInternal: boolean; lotId?: string; recipients?: string[] },
      { storagePath: string; url: string }
    >(functions, "ged_move_file", { timeout: 120_000 })
    const { data: moved } = await move({
      residenceId: document.residenceId,
      source: wasInternal ? document.storagePath : document.url || document.storagePath,
      toInternal: nowInternal,
      ...(document.scope === "lot" && document.lotId
        ? { lotId: document.lotId, recipients: document.recipients }
        : {}),
    })
    Object.assign(
      data,
      nowInternal
        ? { adminOnly: true, storagePath: moved.storagePath, documentPathRecto: "" }
        : { adminOnly: deleteField(), storagePath: deleteField(), documentPathRecto: moved.url }
    )
  }
  await updateRecords(document, data)
  if (options.notify && !nowInternal) {
    await notifyPublication(document, visibility)
  }
}

// Notification « Nouveau document » aux résidents qui le voient (serveur :
// destinataires du lot, occupants du bâtiment, CS ou toute la résidence).
export async function notifyPublication(document: GedDocument, visibility: GedVisibility) {
  const call = httpsCallable<Record<string, unknown>, { sent: number }>(functions, "ged_notify_publication")
  const { data } = await call({
    residenceId: document.residenceId,
    name: document.name,
    ...(document.scope === "lot" ? { lotId: document.lotId, recipients: document.recipients } : {}),
    ...(document.scope === "building" ? { batiment: document.batiment } : {}),
    ...(visibility === "cs" ? { csOnly: true } : {}),
    ...(visibility === "owners" ? { ownersOnly: true } : {}),
  })
  return data.sent
}

export async function trashGedDocument(document: GedDocument) {
  await updateRecords(document, {
    deletedAt: Timestamp.now(),
    deletedBy: actor().uid,
    history: arrayUnion(historyEntry("Mis à la corbeille")),
  })
}

export async function restoreGedDocument(document: GedDocument) {
  await updateRecords(document, {
    deletedAt: deleteField(),
    deletedBy: deleteField(),
    history: arrayUnion(historyEntry("Restauré depuis la corbeille")),
  })
}

function storagePathFromUrl(url: string): string {
  if (!url.includes("/o/")) return ""
  try {
    return decodeURIComponent(new URL(url).pathname.split("/o/")[1])
  } catch {
    return ""
  }
}

// Suppression définitive (depuis la corbeille) : fiches puis fichier.
export async function purgeGedDocument(document: GedDocument) {
  const batch = writeBatch(db)
  for (const recordRef of recordRefs(document)) batch.delete(recordRef)
  await batch.commit()
  const path = document.storagePath || storagePathFromUrl(document.url)
  if (path) {
    await deleteObject(ref(storage, path)).catch(() => undefined)
  }
}

// Journal « Aperçu consulté » : une fois par document et par session.
const viewed = new Set<string>()
export async function logGedView(document: GedDocument) {
  if (viewed.has(document.key)) return
  viewed.add(document.key)
  await updateRecords(document, { history: arrayUnion(historyEntry("Aperçu consulté")) }).catch(() => undefined)
}

// Lien du fichier : celui de la fiche, ou un lien demandé à la volée pour un
// document non partagé (règle Storage : superAdmin seul).
export async function gedFileUrl(document: Pick<GedDocument, "url" | "storagePath">): Promise<string> {
  if (document.url) return document.url
  if (document.storagePath) return getDownloadURL(ref(storage, document.storagePath))
  return ""
}

export async function fetchGedOverview(): Promise<GedOverview> {
  const call = httpsCallable<Record<string, never>, GedOverview>(functions, "ged_overview", { timeout: 120_000 })
  return (await call({})).data
}

export async function findGedDocuments(params: {
  kind: "search" | "trash" | "internal" | "category"
  query?: string
  category?: string
  residenceId?: string
}): Promise<{ items: GedFoundDocument[]; total: number }> {
  const call = httpsCallable<typeof params, { items: GedFoundDocument[]; total: number }>(functions, "ged_find", {
    timeout: 120_000,
  })
  return (await call(params)).data
}

// Document trouvé par le serveur -> GedDocument utilisable par la fiche (les
// exemplaires d'un document de lot = ses destinataires connus).
export function foundToDocument(found: GedFoundDocument): GedDocument {
  return {
    key: foundToKey(found),
    scope: found.scope,
    residenceId: found.residenceId,
    lotId: found.lotId,
    id: found.id,
    holders: found.holders,
    recipients: found.recipients,
    name: found.name,
    category: found.category,
    extension: found.extension,
    timeStamp: toDate(found.timeStamp),
    documentDate: toDate(found.documentDate),
    adminOnly: found.adminOnly,
    csOnly: found.csOnly,
    ownersOnly: found.ownersOnly,
    batiment: found.batiment,
    tags: found.tags,
    deletedAt: toDate(found.deletedAt),
    url: found.url,
    storagePath: found.storagePath,
    size: found.size,
    contentType: "",
    history: [],
  }
}
