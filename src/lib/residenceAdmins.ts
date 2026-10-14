import { arrayRemove, arrayUnion, doc, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from "firebase/firestore"
import { db } from "@/firebase"

// Singleton config/residenceAdmins : uids des comptes superAdmin qui ouvrent
// n'importe quelle résidence sans lot dans l'app résident (cf.
// residence_admin_access.dart, lu à chaque connexion). Un doc par
// environnement (chaque projet Firebase a sa propre base). Lecture/écriture
// réservées au superAdmin (firestore.rules), comme la page Accès.
const configDoc = doc(db, "config", "residenceAdmins")

export function subscribeToResidenceAdmins(
  onData: (uids: string[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    configDoc,
    (snapshot) => onData(((snapshot.data()?.uids as string[] | undefined) ?? []).filter(Boolean)),
    onError
  )
}

export async function addResidenceAdmin(uid: string) {
  await setDoc(configDoc, { uids: arrayUnion(uid), updatedAt: serverTimestamp() }, { merge: true })
}

export async function removeResidenceAdmin(uid: string) {
  await setDoc(configDoc, { uids: arrayRemove(uid), updatedAt: serverTimestamp() }, { merge: true })
}
