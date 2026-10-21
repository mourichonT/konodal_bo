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
  type DocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore"
import { getDownloadURL, ref, uploadBytes } from "firebase/storage"
import { db, storage } from "@/firebase"
import type { ResidenceDocument, ResidenceDocumentInput } from "@/types/document"

function toDateOrNull(value: unknown): Date | null {
  return value && typeof (value as { toDate?: unknown }).toDate === "function"
    ? (value as { toDate: () => Date }).toDate()
    : null
}

function documentsCollection(residenceId: string) {
  return collection(db, "residences", residenceId, "documents_copro")
}

// Mêmes clés Firestore que DocumentModel côté app mobile
// (document_model.dart) - `type` porte le libellé de catégorie.
function toResidenceDocument(residenceId: string, d: DocumentSnapshot<DocumentData>): ResidenceDocument {
  const data = d.data() ?? {}
  return {
    id: d.id,
    residenceId,
    name: (data.name as string) ?? "",
    category: (data.type as string) ?? "",
    documentPathRecto: (data.documentPathRecto as string) ?? "",
    extension: (data.extension as string) ?? "",
    timeStamp: toDateOrNull(data.timeStamp),
    adminOnly: data.adminOnly === true,
  }
}

export function subscribeToResidenceDocuments(
  residenceId: string,
  onData: (documents: ResidenceDocument[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    documentsCollection(residenceId),
    (snapshot) => onData(snapshot.docs.map((d) => toResidenceDocument(residenceId, d))),
    onError
  )
}

// Storage path identique à celui utilisé par l'app mobile
// (add_docs_form.dart) pour ces mêmes documents.
async function uploadResidenceDocumentFile(
  residenceId: string,
  file: File
): Promise<{ url: string; extension: string }> {
  const extension = file.name.includes(".") ? (file.name.split(".").pop() ?? "").toLowerCase() : ""
  const path = `residences/${residenceId}/documents_copro/${crypto.randomUUID()}${extension ? `.${extension}` : ""}`
  const fileRef = ref(storage, path)
  await uploadBytes(fileRef, file)
  return { url: await getDownloadURL(fileRef), extension }
}

// Réservé isCsMember(residenceId)/isSuperAdmin() côté firestore.rules
// (documents_copro.write) - même pattern que les autres écritures
// résidence du BO (lots, events).
export async function createResidenceDocument(residenceId: string, input: ResidenceDocumentInput) {
  const { url, extension } = await uploadResidenceDocumentFile(residenceId, input.file)
  const ref_ = doc(documentsCollection(residenceId))
  await setDoc(ref_, {
    name: input.name,
    type: input.category,
    documentPathRecto: url,
    extension,
    residenceId,
    timeStamp: serverTimestamp(),
    ...(input.adminOnly ? { adminOnly: true } : {}),
  })
}

// Partage d'un document (superAdmin) : adminOnly le cache à l'agence et ses
// agents (filtre de useAllResidenceDocuments) et aux résidents (filtre de
// firestore_docs_repository.dart côté app). Simple filtre d'affichage, pas
// une règle : firestore.rules ne peut pas l'imposer sans faire échouer la
// lecture de toute la collection par l'app publiée (requête sans filtre).
// Partager retire le champ : le document redevient identique aux autres.
export async function setResidenceDocumentAdminOnly(residenceId: string, documentId: string, adminOnly: boolean) {
  await updateDoc(doc(documentsCollection(residenceId), documentId), {
    adminOnly: adminOnly ? true : deleteField(),
  })
}

export async function deleteResidenceDocument(residenceId: string, documentId: string) {
  await deleteDoc(doc(documentsCollection(residenceId), documentId))
}
