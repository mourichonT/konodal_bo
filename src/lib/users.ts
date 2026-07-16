import {
  collection,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
  type DocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore"
import type { User as FirebaseUser } from "firebase/auth"
import { db } from "@/firebase"
import type { KonodalUser } from "@/types/user"

const usersCollection = collection(db, "users")

function toDateOrNull(value: unknown): Date | null {
  return value && typeof (value as { toDate?: unknown }).toDate === "function"
    ? (value as { toDate: () => Date }).toDate()
    : null
}

function toKonodalUser(snapshot: DocumentSnapshot<DocumentData>): KonodalUser {
  const data = snapshot.data() ?? {}
  const userGroup = (data.user as Record<string, unknown>) ?? {}
  const profilGroup = (data.profil as Record<string, unknown>) ?? {}
  return {
    uid: snapshot.id,
    email: (data.email as string) ?? "",
    name: (userGroup.name as string) ?? "",
    surname: (userGroup.surname as string) ?? "",
    phone: (profilGroup.phone as string) ?? "",
    isApproved: (data.isApproved as boolean) ?? false,
    accountType: (data.accountType as string) ?? "utilisateur",
    createdDate: toDateOrNull(data.createdDate),
    birthday: toDateOrNull(userGroup.birthday),
    sex: (userGroup.sex as string) ?? "",
    nationality: (userGroup.nationality as string) ?? "",
    placeOfborn: (userGroup.placeOfborn as string) ?? "",
    isInfoCorrect: (userGroup.isInfoCorrect as boolean) ?? false,
    rejectionReason: (data.rejectionReason as string) ?? null,
  }
}

// Champs minimaux acceptés par firestore.rules à la création d'un compte
// (users/{uid} : isApproved doit être false, accountType 'utilisateur' -
// tout le reste est optionnel côté modèle Dart, cf. User.fromMap qui
// tolère l'absence des groupes imbriqués "user"/"profil"). Un compte créé
// depuis ce backoffice est ensuite promu manuellement en superAdmin via un
// script Admin SDK, hors règles.
export async function ensureUserDocument(user: FirebaseUser) {
  const ref = doc(db, "users", user.uid)
  const snapshot = await getDoc(ref)
  if (snapshot.exists()) return

  await setDoc(ref, {
    uid: user.uid,
    email: user.email ?? "",
    isApproved: false,
    accountType: "utilisateur",
    createdDate: serverTimestamp(),
  })
}

// Pas de orderBy Firestore ici : certains comptes plus anciens ou créés hors
// app (professionnel/superAdmin) peuvent ne pas avoir `createdDate`, et
// Firestore exclurait silencieusement ces documents d'un orderBy dessus. Tri
// fait côté client à la place.
export function subscribeToUsers(
  onData: (users: KonodalUser[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    usersCollection,
    (snapshot) => onData(snapshot.docs.map(toKonodalUser)),
    onError
  )
}

export function subscribeToUser(
  uid: string,
  onData: (user: KonodalUser | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(usersCollection, uid),
    (snapshot) => onData(snapshot.exists() ? toKonodalUser(snapshot) : null),
    onError
  )
}

// Réservé aux comptes superAdmin côté firestore.rules (users/{uid}.update) -
// un résident/bailleur ne peut jamais modifier isApproved lui-même. Approuver
// efface un éventuel motif de refus précédent (deleteField, pas juste "").
export async function setUserApproved(uid: string, isApproved: boolean) {
  await updateDoc(
    doc(usersCollection, uid),
    isApproved ? { isApproved, rejectionReason: deleteField() } : { isApproved }
  )
}

// Refus explicite avec motif (affiché au résident dans l'app mobile,
// NoApprovalPage) - distinct d'une simple révocation sans explication.
export async function rejectUser(uid: string, reason: string) {
  await updateDoc(doc(usersCollection, uid), { isApproved: false, rejectionReason: reason })
}

export type UserDocument = {
  id: string
  type: string
  name?: string
  documentPathRecto: string
  documentPathVerso?: string
  timeStamp: Date | null
}

function toUserDocument(d: DocumentSnapshot<DocumentData>): UserDocument {
  const data = d.data() ?? {}
  const timeStamp = data.timeStamp
  return {
    id: d.id,
    type: (data.type as string) ?? "",
    name: data.name as string | undefined,
    documentPathRecto: (data.documentPathRecto as string) ?? "",
    documentPathVerso: data.documentPathVerso as string | undefined,
    timeStamp: timeStamp && typeof timeStamp.toDate === "function" ? timeStamp.toDate() : null,
  }
}

// users/{uid}/documents : pièces d'identité déposées à l'inscription. Lecture
// réservée à isOwner/isSharedTenantDoc/isPendingDemandeLandlord/isSuperAdmin
// côté firestore.rules (isSuperAdmin ajouté pour ce backoffice - même
// pattern que users/{uid}/lots/{lotId}/documents qui l'avait déjà).
export function subscribeToUserDocuments(
  uid: string,
  onData: (documents: UserDocument[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, "users", uid, "documents"),
    (snapshot) => onData(snapshot.docs.map(toUserDocument)),
    onError
  )
}

// users/{uid}/lots/{lotId}/documents : justificatifs propres à ce lot précis
// (ex: attestation de propriété, facture au nom du locataire) - circuit
// distinct de users/{uid}/documents (pièce d'identité générale), cf. mémoire
// du domain model. Lecture déjà ouverte à isSuperAdmin côté firestore.rules,
// aucune modif de règles nécessaire pour celui-ci.
export function subscribeToUserLotDocuments(
  uid: string,
  lotId: string,
  onData: (documents: UserDocument[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, "users", uid, "lots", lotId, "documents"),
    (snapshot) => onData(snapshot.docs.map(toUserDocument)),
    onError
  )
}

export type UserLot = {
  id: string
  residenceId: string
  nameLot: string
  statutResident: string
  isApprovedLot: boolean
}

// users/{uid}/lots : jamais créé depuis le backoffice (toujours en
// self-service par le résident, cf. firestore.rules - create exige
// isOwner(uid)). Le backoffice ne fait que lire et approuver
// (isApprovedLot: false -> true), réservé à isSuperAdmin côté règles.
export function subscribeToUserLots(
  uid: string,
  onData: (lots: UserLot[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, "users", uid, "lots"),
    (snapshot) => {
      onData(
        snapshot.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            residenceId: (data.residenceId as string) ?? "",
            nameLot: (data.nameLot as string) ?? "",
            statutResident: (data.statutResident as string) ?? "",
            isApprovedLot: (data.isApprovedLot as boolean) ?? false,
          }
        })
      )
    },
    onError
  )
}

// Idempotent à dessein : ré-écrire `true` alors que c'est déjà `true` reste
// utile - ça redéclenche la Cloud Function sync_lot_approval si elle avait
// échoué la première fois faute de users/{uid}.isApproved (cf. mémoire du
// projet sur l'ordre approbation identité -> approbation lot).
export async function approveUserLot(uid: string, lotId: string) {
  await updateDoc(doc(db, "users", uid, "lots", lotId), { isApprovedLot: true })
}
