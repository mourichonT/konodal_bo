import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type DocumentData,
  type DocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore"
import { getDownloadURL, ref, uploadBytes } from "firebase/storage"
import { db, storage } from "@/firebase"
import type { LotDocument, LotDocumentInput } from "@/types/document"

function toDateOrNull(value: unknown): Date | null {
  return value && typeof (value as { toDate?: unknown }).toDate === "function"
    ? (value as { toDate: () => Date }).toDate()
    : null
}

function userLotDocumentsCollection(uid: string, lotId: string) {
  return collection(db, "users", uid, "lots", lotId, "documents")
}

function toLotDocument(residenceId: string, lotId: string, d: DocumentSnapshot<DocumentData>): LotDocument {
  const data = d.data() ?? {}
  return {
    id: d.id,
    lotId,
    residenceId,
    name: (data.name as string) ?? "",
    category: (data.type as string) ?? "",
    documentPathRecto: (data.documentPathRecto as string) ?? "",
    extension: (data.extension as string) ?? "",
    timeStamp: toDateOrNull(data.timeStamp),
    recipientUids: (data.destinataire as string[]) ?? [],
  }
}

function dedupeById(documents: LotDocument[]): LotDocument[] {
  const byId = new Map<string, LotDocument>()
  for (const document of documents) byId.set(document.id, document)
  return [...byId.values()]
}

// Un document de lot est stocké en autant de copies que de destinataires
// (users/{uid}/lots/{lotId}/documents/{docId}, même docId partagé - cf.
// SubmitDocController.submitFormIndividuel côté app mobile) : on souscrit
// une fois par destinataire connu (propriétaire(s)/locataire(s) du lot) et
// on dédoublonne par docId côté client plutôt que de dépendre d'un
// collectionGroup (pas disponible côté connectkasa).
export function subscribeToLotDocuments(
  residenceId: string,
  lotId: string,
  recipientUids: string[],
  onData: (documents: LotDocument[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  if (recipientUids.length === 0) {
    onData([])
    return () => {}
  }
  const byUid = new Map<string, LotDocument[]>()
  const emit = () => onData(dedupeById([...byUid.values()].flat()))
  const unsubscribes = recipientUids.map((uid) =>
    onSnapshot(
      userLotDocumentsCollection(uid, lotId),
      (snapshot) => {
        byUid.set(uid, snapshot.docs.map((d) => toLotDocument(residenceId, lotId, d)))
        emit()
      },
      onError
    )
  )
  return () => unsubscribes.forEach((unsub) => unsub())
}

// Storage : contrairement au client mobile qui réuploade les mêmes octets
// une fois par destinataire (user/{uid}/documentsLot/{refLot}/...), on
// uploade UNE seule fois - une URL de téléchargement Storage donne accès
// au fichier indépendamment des règles de chemin, donc dupliquer le blob
// n'apporte rien. Seule la petite copie Firestore est dupliquée (comme le
// fait l'app), pour rester lisible par elle sans aucun changement de son
// côté.
async function uploadLotDocumentFile(
  residenceId: string,
  lotId: string,
  file: File
): Promise<{ url: string; extension: string }> {
  const extension = file.name.includes(".") ? (file.name.split(".").pop() ?? "").toLowerCase() : ""
  const path = `residences/${residenceId}/documents_lot/${lotId}/${crypto.randomUUID()}${extension ? `.${extension}` : ""}`
  const fileRef = ref(storage, path)
  await uploadBytes(fileRef, file)
  return { url: await getDownloadURL(fileRef), extension }
}

export async function createLotDocument(residenceId: string, lotId: string, input: LotDocumentInput) {
  if (input.recipientUids.length === 0) {
    throw new Error("Aucun destinataire sélectionné")
  }
  const { url, extension } = await uploadLotDocumentFile(residenceId, lotId, input.file)
  const sharedId = doc(userLotDocumentsCollection(input.recipientUids[0], lotId)).id
  const data = {
    name: input.name,
    type: input.category,
    documentPathRecto: url,
    extension,
    lotId,
    residenceId,
    destinataire: input.recipientUids,
    timeStamp: serverTimestamp(),
  }
  const batch = writeBatch(db)
  for (const uid of input.recipientUids) {
    batch.set(doc(userLotDocumentsCollection(uid, lotId), sharedId), data)
  }
  await batch.commit()
}

// Supprime toutes les copies (une par destinataire), même logique que
// deleteDocument côté app mobile (firestore_docs_repository.dart).
export async function deleteLotDocument(lotId: string, documentId: string, recipientUids: string[]) {
  const batch = writeBatch(db)
  for (const uid of recipientUids) {
    batch.delete(doc(userLotDocumentsCollection(uid, lotId), documentId))
  }
  await batch.commit()
}
