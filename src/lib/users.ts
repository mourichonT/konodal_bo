import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit as firestoreLimit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore"
import type { User as FirebaseUser } from "firebase/auth"
import { getDownloadURL, ref, uploadBytes } from "firebase/storage"
import { db, storage } from "@/firebase"
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
    profilePic: (profilGroup.profilPic as string) || undefined,
    isApproved: (data.isApproved as boolean) ?? false,
    accountType: (data.accountType as string) ?? "utilisateur",
    createdDate: toDateOrNull(data.createdDate),
    birthday: toDateOrNull(userGroup.birthday),
    sex: (userGroup.sex as string) ?? "",
    nationality: (userGroup.nationality as string) ?? "",
    placeOfborn: (userGroup.placeOfborn as string) ?? "",
    isInfoCorrect: (userGroup.isInfoCorrect as boolean) ?? false,
    rejectionReason: (data.rejectionReason as string) ?? null,
    active: data.active as boolean | undefined,
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

export type UserIdentityInput = {
  name: string
  surname: string
  phone: string
  birthday: Date | null
  sex: string
  nationality: string
  placeOfborn: string
}

// Correction d'une erreur de reconnaissance (OCR à l'inscription) par un
// admin - met à jour uniquement les champs imbriqués user.*/profil.phone,
// jamais email (identifiant du compte Firebase Auth, non modifiable ici) ni
// isApproved/accountType/isInfoCorrect (gérés séparément).
export async function updateUserIdentity(uid: string, input: UserIdentityInput) {
  await updateDoc(doc(usersCollection, uid), {
    "user.name": input.name,
    "user.surname": input.surname,
    "user.sex": input.sex,
    "user.nationality": input.nationality,
    "user.placeOfborn": input.placeOfborn,
    "user.birthday": input.birthday ? Timestamp.fromDate(input.birthday) : null,
    "profil.phone": input.phone,
  })
}

export type OwnProfileInput = {
  name: string
  surname: string
  phone: string
}

// Auto-édition de son propre profil BO (page /profil, tous rôles) - à ne
// pas confondre avec updateUserIdentity (correction d'un résident PAR un
// admin) : ici l'appelant modifie son propre compte, déjà couvert par
// firestore.rules (users/{uid}.update autorise isOwner(uid) tant
// qu'isApproved/accountType ne bougent pas).
export async function updateOwnProfile(uid: string, input: OwnProfileInput) {
  await updateDoc(doc(usersCollection, uid), {
    "user.name": input.name,
    "user.surname": input.surname,
    "profil.phone": input.phone,
  })
}

// Storage path identique à FirestoreStorageRepository.uploadImg côté app
// mobile (racine="user", résidence=uid, dossier="photo") pour qu'une photo
// posée depuis le BO suive exactement la même convention que si le compte
// l'avait déposée lui-même depuis l'app.
export async function uploadOwnProfilePic(uid: string, file: File): Promise<string> {
  const extension = file.name.includes(".") ? (file.name.split(".").pop() ?? "").toLowerCase() : "jpg"
  const path = `user/${uid}/photo/${crypto.randomUUID()}.${extension}`
  const fileRef = ref(storage, path)
  await uploadBytes(fileRef, file)
  const url = await getDownloadURL(fileRef)
  await updateDoc(doc(usersCollection, uid), { "profil.profilPic": url })
  return url
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
//
// scopedResidenceIds (agence/agent uniquement, cf. useScopedResidenceIds) :
// requis pour que la règle isProfessionnelResidence(resource.data.residenceId)
// autorise ne serait-ce que la LECTURE de cette sous-collection. Cloud
// Firestore n'évalue un `get()` construit à partir d'un champ du document
// (ici residenceId) pour une requête *list* QUE si le champ est contraint
// par un where() de la requête elle-même (vérifié empiriquement : un get()
// isolé sur un lotId connu passe, mais le onSnapshot sur toute la
// collection échoue par "Missing or insufficient permissions" sans ce
// filtre, alors que la même règle passe avec un where("residenceId","in",...)
// - Firestore ne peut pas prouver la sécurité de la requête sans lui).
// undefined/null = superAdmin, aucun filtre nécessaire (isSuperAdmin() ne
// dépend pas des champs du document). Tableau vide = professionnel sans
// aucune résidence en périmètre : on n'interroge même pas Firestore.
export function subscribeToUserLots(
  uid: string,
  onData: (lots: UserLot[]) => void,
  onError: (error: Error) => void,
  scopedResidenceIds?: string[] | null
): Unsubscribe {
  if (scopedResidenceIds && scopedResidenceIds.length === 0) {
    onData([])
    return () => {}
  }
  const lotsCollection = collection(db, "users", uid, "lots")
  // Limite "in" Firestore : 30 valeurs - une gérance gérant plus de 30
  // résidences n'est pas couverte ici, limitation assumée comme ailleurs
  // dans ce lot RBAC (cf. useScopedResidenceIds).
  const lotsQuery = scopedResidenceIds
    ? query(lotsCollection, where("residenceId", "in", scopedResidenceIds.slice(0, 30)))
    : lotsCollection
  return onSnapshot(
    lotsQuery,
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

// Résout uid -> "Prénom Nom" (ou email/uid à défaut) pour l'affichage - ex:
// destinataires d'un document de lot (DocumentsPage). uids dédupliqués
// avant lecture (un même destinataire peut apparaître comme propriétaire
// ET locataire).
export async function resolveUserLabels(uids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(uids)]
  const snapshots = await Promise.all(unique.map((uid) => getDoc(doc(usersCollection, uid))))
  return new Map(
    snapshots.map((snap, i) => {
      const data = snap.data()
      const userGroup = (data?.user as Record<string, unknown>) ?? {}
      const name = [userGroup.name, userGroup.surname].filter(Boolean).join(" ").trim()
      return [unique[i], name || (data?.email as string) || unique[i]]
    })
  )
}

// Résout des uids en fiches complètes (nom/prénom/email/téléphone) - ex:
// agents nommés d'une gérance (serviceSyndicAgentUids/
// geranceLocativeAgentUids, cf. AgencesPage), qui n'existent plus qu'en tant
// qu'uid depuis qu'un agent = un compte déjà invité, plus un objet séparé
// saisi à la main.
export async function resolveUsersByUids(uids: string[]): Promise<KonodalUser[]> {
  const unique = [...new Set(uids)]
  const snapshots = await Promise.all(unique.map((uid) => getDoc(doc(usersCollection, uid))))
  return snapshots.filter((snap) => snap.exists()).map(toKonodalUser)
}

// Retrouve un compte par email (ex: residence.geranceRef.agentMail, qui
// n'identifie l'agent responsable que par son adresse) - au plus un
// résultat attendu, l'email étant l'identifiant du compte Firebase Auth.
export async function findUserByEmail(email: string): Promise<KonodalUser | null> {
  const snapshot = await getDocs(query(usersCollection, where("email", "==", email), firestoreLimit(1)))
  return snapshot.empty ? null : toKonodalUser(snapshot.docs[0])
}

// Idempotent à dessein : ré-écrire `true` alors que c'est déjà `true` reste
// utile - ça redéclenche la Cloud Function sync_lot_approval si elle avait
// échoué la première fois faute de users/{uid}.isApproved (cf. mémoire du
// projet sur l'ordre approbation identité -> approbation lot).
export async function approveUserLot(uid: string, lotId: string) {
  await updateDoc(doc(db, "users", uid, "lots", lotId), { isApprovedLot: true })
}
