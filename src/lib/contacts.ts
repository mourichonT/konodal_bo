import {
  addDoc,
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore"
import { db } from "@/firebase"
import { emptyAddress, type Address } from "@/types/residence"
import type { Contact } from "@/types/contact"

const contactsCollection = collection(db, "contacts")

function toContact(d: DocumentSnapshot<DocumentData>): Contact {
  const data = d.data() ?? {}
  const address = (data.address as Address) ?? emptyAddress
  return {
    id: d.id,
    name: (data.name as string) ?? "",
    service: (data.service as string) ?? "",
    phone: (data.phone as string) ?? "",
    mail: (data.mail as string) ?? "",
    address,
    web: (data.web as string) ?? "",
    residencesIds: (data.residencesIds as string[]) ?? [],
    likelyDuplicateIds: (data.likelyDuplicateIds as string[]) ?? [],
    isApproved: (data.isApproved as boolean) ?? false,
  }
}

// Collection racine "contacts" (pas residences/{id}/contacts, déprécié côté
// app) - le compte BO est isSuperAdmin, lit tout sans filtre residencesIds
// (cf. firestore.rules:509-533).
export function subscribeToContacts(
  onData: (contacts: Contact[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    contactsCollection,
    (snapshot) => onData(snapshot.docs.map(toContact)),
    onError
  )
}

export function subscribeToContact(
  id: string,
  onData: (contact: Contact | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(contactsCollection, id),
    (snapshot) => onData(snapshot.exists() ? toContact(snapshot) : null),
    onError
  )
}

// Champs "fiche" (colonne gauche de ContactDetailPage) - le rattachement aux
// résidences (colonne droite) se gère séparément via
// updateContactResidences, écriture immédiate par case cochée plutôt que
// groupée avec le formulaire de la fiche.
export type ContactProfileInput = {
  name: string
  service: string
  phone: string
  mail: string
  address: Address
  web: string
}

export type ContactInput = ContactProfileInput & {
  residencesIds: string[]
}

// Créé par un admin = déjà validé (pas de file d'attente pour ses propres
// créations) - contrairement à une création côté app, toujours isApproved:
// false, cf. firestore.rules.
export async function createContact(input: ContactInput) {
  await addDoc(contactsCollection, {
    ...input,
    nameNormalized: input.name.trim().toLowerCase(),
    likelyDuplicateIds: [],
    isApproved: true,
  })
}

// Réservé isSuperAdmin côté règles - un CS member ne peut toucher que
// residencesIds, jamais les autres champs (cf. mémoire projet sur ce lot).
export async function updateContact(id: string, input: ContactProfileInput) {
  await updateDoc(doc(contactsCollection, id), {
    ...input,
    nameNormalized: input.name.trim().toLowerCase(),
  })
}

// Remplacement complet du tableau (pas arrayUnion/arrayRemove incrémental) :
// le bypass isSuperAdmin autorise un set direct, plus simple pour la carte
// à checkboxes qui connaît déjà l'état cible complet.
export async function updateContactResidences(id: string, residencesIds: string[]) {
  await updateDoc(doc(contactsCollection, id), { residencesIds })
}

export async function updateContactApproval(id: string, isApproved: boolean) {
  await updateDoc(doc(contactsCollection, id), { isApproved })
}

export async function deleteContact(id: string) {
  await deleteDoc(doc(contactsCollection, id))
}

// Le flag n'est pas un vrai doublon - effacé symétriquement des deux fiches.
export async function dismissDuplicate(contactId: string, otherId: string) {
  const batch = writeBatch(db)
  batch.update(doc(contactsCollection, contactId), { likelyDuplicateIds: arrayRemove(otherId) })
  batch.update(doc(contactsCollection, otherId), { likelyDuplicateIds: arrayRemove(contactId) })
  await batch.commit()
}

// Fusionne mergeId dans keepId : union des résidences, suppression de
// mergeId, et nettoyage de toute référence à mergeId dans
// likelyDuplicateIds des autres contacts (remplacée par keepId) - action
// explicite et ponctuelle depuis l'UI, pas un script en masse, donc pas
// besoin d'une vraie transaction Firestore.
export async function mergeContacts(keepId: string, mergeId: string) {
  const [keepSnap, mergeSnap] = await Promise.all([
    getDoc(doc(contactsCollection, keepId)),
    getDoc(doc(contactsCollection, mergeId)),
  ])
  const keep = toContact(keepSnap)
  const merge = toContact(mergeSnap)
  const mergedResidencesIds = [...new Set([...keep.residencesIds, ...merge.residencesIds])]

  const referencing = await getDocs(
    query(contactsCollection, where("likelyDuplicateIds", "array-contains", mergeId))
  )

  const batch = writeBatch(db)
  batch.update(doc(contactsCollection, keepId), {
    residencesIds: mergedResidencesIds,
    likelyDuplicateIds: keep.likelyDuplicateIds.filter((id) => id !== mergeId),
  })
  for (const referencingDoc of referencing.docs) {
    if (referencingDoc.id === keepId) continue
    const ids = (referencingDoc.data().likelyDuplicateIds as string[]) ?? []
    const next = [...new Set([...ids.filter((id) => id !== mergeId), keepId])]
    batch.update(referencingDoc.ref, { likelyDuplicateIds: next })
  }
  batch.delete(doc(contactsCollection, mergeId))
  await batch.commit()
}
