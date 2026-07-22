import {
  addDoc,
  arrayRemove,
  collection,
  deleteField,
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
import { emptyAddress, type Address, type Residence } from "@/types/residence"
import type { Contact } from "@/types/contact"

const contactsCollection = collection(db, "contacts")
const residencesCollection = collection(db, "residences")

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
    likelyDuplicateIds: (data.likelyDuplicateIds as string[]) ?? [],
    isApproved: (data.isApproved as boolean) ?? false,
  }
}

// Le rattachement résidence<->contact ne vit plus sur ce document (cf.
// residences/{id}.contactRefs) - Firestore n'a pas de sécurité par champ, un
// tableau de résidences exposé sur un contact partagé lisible par plusieurs
// agences ferait fuiter les résidences des autres à chacune d'elles.
// residenceIdsForContact() ci-dessous dérive le rattachement à partir des
// résidences déjà chargées, sans requête supplémentaire.
export function residenceIdsForContact(residences: Residence[], contactId: string): string[] {
  return residences.filter((r) => r.contactRefs?.[contactId]).map((r) => r.id)
}

// Collection racine "contacts" (pas residences/{id}/contacts, déprécié côté
// app) - le compte BO est isSuperAdmin, lit tout.
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
// setContactResidenceLink, écriture immédiate par case cochée plutôt que
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

// Créé par un superAdmin = déjà validé, pas de file d'attente. Une Agence/
// un Agent (backoffice web) doit en revanche créer avec isApproved: false
// - c'est ce qu'exige firestore.rules (contacts/{id}.create), qui réserve
// isApproved: true à isSuperAdmin() uniquement ; envoyer true depuis un
// compte agence/agent est un Missing or insufficient permissions direct.
// Le contact lui-même ne stocke plus residencesIds : chaque résidence
// sélectionnée reçoit son propre contactRefs.{id} = true.
export async function createContact(input: ContactInput, isApproved: boolean) {
  const { residencesIds, ...profile } = input
  const docRef = await addDoc(contactsCollection, {
    ...profile,
    nameNormalized: profile.name.trim().toLowerCase(),
    likelyDuplicateIds: [],
    isApproved,
  })
  if (residencesIds.length > 0) {
    const batch = writeBatch(db)
    for (const residenceId of residencesIds) {
      batch.update(doc(residencesCollection, residenceId), { [`contactRefs.${docRef.id}`]: true })
    }
    await batch.commit()
  }
}

// Réservé isSuperAdmin côté règles - toute correction de fiche passe
// désormais exclusivement par le BO (le rattachement résidence, lui, se
// fait sur residences/{id}, cf. setContactResidenceLink).
export async function updateContact(id: string, input: ContactProfileInput) {
  await updateDoc(doc(contactsCollection, id), {
    ...input,
    nameNormalized: input.name.trim().toLowerCase(),
  })
}

// Un toggle = une écriture ciblée sur LA résidence concernée, pas un set
// complet d'un tableau sur le contact (cf. commentaire en tête de fichier).
export async function setContactResidenceLink(
  residenceId: string,
  contactId: string,
  linked: boolean
) {
  await updateDoc(doc(residencesCollection, residenceId), {
    [`contactRefs.${contactId}`]: linked ? true : deleteField(),
  })
}

export async function updateContactApproval(id: string, isApproved: boolean) {
  await updateDoc(doc(contactsCollection, id), { isApproved })
}

// Nettoie aussi les contactRefs des résidences qui référencent encore ce
// contact - sinon elles pointeraient vers un document supprimé.
export async function deleteContact(id: string) {
  const referencing = await getDocs(
    query(residencesCollection, where(`contactRefs.${id}`, "==", true))
  )
  const batch = writeBatch(db)
  for (const residenceDoc of referencing.docs) {
    batch.update(residenceDoc.ref, { [`contactRefs.${id}`]: deleteField() })
  }
  batch.delete(doc(contactsCollection, id))
  await batch.commit()
}

// Le flag n'est pas un vrai doublon - effacé symétriquement des deux fiches.
export async function dismissDuplicate(contactId: string, otherId: string) {
  const batch = writeBatch(db)
  batch.update(doc(contactsCollection, contactId), { likelyDuplicateIds: arrayRemove(otherId) })
  batch.update(doc(contactsCollection, otherId), { likelyDuplicateIds: arrayRemove(contactId) })
  await batch.commit()
}

// Fusionne mergeId dans keepId : bascule sur keepId chaque résidence dont le
// contactRefs référence encore mergeId, supprime mergeId, et nettoie toute
// référence à mergeId dans likelyDuplicateIds des autres contacts
// (remplacée par keepId) - action explicite et ponctuelle depuis l'UI, pas
// un script en masse, donc pas besoin d'une vraie transaction Firestore.
export async function mergeContacts(keepId: string, mergeId: string) {
  const [keepSnap, residencesReferencingMerge, contactsReferencingMerge] = await Promise.all([
    getDoc(doc(contactsCollection, keepId)),
    getDocs(query(residencesCollection, where(`contactRefs.${mergeId}`, "==", true))),
    getDocs(query(contactsCollection, where("likelyDuplicateIds", "array-contains", mergeId))),
  ])
  const keep = toContact(keepSnap)

  const batch = writeBatch(db)
  for (const residenceDoc of residencesReferencingMerge.docs) {
    batch.update(residenceDoc.ref, {
      [`contactRefs.${keepId}`]: true,
      [`contactRefs.${mergeId}`]: deleteField(),
    })
  }
  batch.update(doc(contactsCollection, keepId), {
    likelyDuplicateIds: keep.likelyDuplicateIds.filter((id) => id !== mergeId),
  })
  for (const referencingDoc of contactsReferencingMerge.docs) {
    if (referencingDoc.id === keepId) continue
    const ids = (referencingDoc.data().likelyDuplicateIds as string[]) ?? []
    const next = [...new Set([...ids.filter((id) => id !== mergeId), keepId])]
    batch.update(referencingDoc.ref, { likelyDuplicateIds: next })
  }
  batch.delete(doc(contactsCollection, mergeId))
  await batch.commit()
}
