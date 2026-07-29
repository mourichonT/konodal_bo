import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
  type DocumentData,
  type DocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore"
import { db } from "@/firebase"
import { emptyAddress } from "@/types/residence"

const emergencyContactsCollection = collection(db, "emergencyContactsFr")

// Numéros d'urgence nationaux (police, pompiers, SAMU...), lus par l'app
// mobile sans notion de résidence (EmergenciesContactsView côté Dart, cf.
// getEmergenciesContacts) - jamais scopés, contrairement à contacts.ts.
// Modèle Contact réutilisé côté app (même Contact.fromJson que
// residences/{id}.contactRefs), mais firestore.rules verrouillait toute
// écriture (write: if false) jusqu'ici : gérable uniquement via un script
// Admin SDK ou la Console Firebase. Désormais ouvert à isSuperAdmin.
export type EmergencyContact = {
  id: string
  name: string
  // Texte libre (pas la liste fermée CONTACT_SERVICES des prestataires) -
  // EmergenciesContactsView._iconForService ne reconnaît que "Sécurité"
  // (icône police) et "Urgence" (icône urgence), tout le reste retombe sur
  // une icône téléphone générique. Affiché aussi en sous-titre côté app.
  service: string
  phone: string
}

function toEmergencyContact(d: DocumentSnapshot<DocumentData>): EmergencyContact {
  const data = d.data() ?? {}
  return {
    id: d.id,
    name: (data.name as string) ?? "",
    service: (data.service as string) ?? "",
    phone: (data.phone as string) ?? "",
  }
}

export function subscribeToEmergencyContacts(
  onData: (contacts: EmergencyContact[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    emergencyContactsCollection,
    (snapshot) => onData(snapshot.docs.map(toEmergencyContact)),
    onError
  )
}

export type EmergencyContactInput = {
  name: string
  service: string
  phone: string
}

export async function createEmergencyContact(input: EmergencyContactInput) {
  await addDoc(emergencyContactsCollection, {
    ...input,
    // "mail"/"web"/"address" : jamais affichés ni utilisés ici, mais
    // Contact.fromJson côté app attend une "address" (nested ou absente,
    // les deux sont tolérées) - omis puisque non requis, contrairement à
    // "service" qui est un paramètre non-nullable du constructeur Dart.
    mail: "",
    web: "",
    address: emptyAddress,
    likelyDuplicateIds: [],
    isApproved: true,
  })
}

export async function updateEmergencyContact(id: string, input: EmergencyContactInput) {
  await updateDoc(doc(emergencyContactsCollection, id), { ...input })
}

export async function deleteEmergencyContact(id: string) {
  await deleteDoc(doc(emergencyContactsCollection, id))
}
