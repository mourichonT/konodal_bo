import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
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
import { httpsCallable } from "firebase/functions"
import { db, storage, functions } from "@/firebase"
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
    pendingLotResidenceIds: (data.pendingLotResidenceIds as string[] | undefined) ?? [],
    isCertified: (data.isCertified as boolean) ?? false,
    certificationStatus:
      data.certificationStatus === "pending" || data.certificationStatus === "rejected"
        ? data.certificationStatus
        : null,
  }
}

// Même algorithme que generateUniqueRefUserApp côté app mobile (Dart,
// lib/controllers/features/generate_ref_user_app.dart) : 8 premiers
// caractères de l'uid en minuscule, avec repli sur les 7 premiers + 1
// caractère décalé en cas de collision (négligeable en pratique, l'uid
// Firebase Auth étant déjà quasi-unique sur ce préfixe).
async function generateUniqueRefUserApp(uid: string): Promise<string> {
  let refUserApp = uid.substring(0, 8).toLowerCase()
  let attempt = 0
  while (true) {
    const snapshot = await getDocs(query(usersCollection, where("refUserApp", "==", refUserApp)))
    if (snapshot.empty) return refUserApp
    refUserApp =
      uid.substring(0, 7).toLowerCase() +
      String.fromCharCode(uid.charCodeAt(7) + (attempt % 26)).toLowerCase()
    attempt++
  }
}

// Champs minimaux acceptés par firestore.rules à la création d'un compte
// (users/{uid} : isApproved doit être false, accountType 'utilisateur' -
// tout le reste est optionnel côté modèle Dart, cf. User.fromMap qui
// tolère l'absence des groupes imbriqués "user"/"profil"). Un compte créé
// depuis ce backoffice est ensuite promu manuellement en superAdmin via un
// script Admin SDK, hors règles.
//
// refUserApp posé dès la création (pas seulement côté app mobile à la fin
// de l'inscription, cf. FirestoreUserRepository.setUser) : c'est le
// marqueur que exports.cleanupAbandonedSignups (functions/index.js, repo
// konodal_app) utilise pour distinguer une inscription mobile abandonnée
// (candidate à la suppression après 20 min) d'un compte légitime - sans
// lui, un compte créé depuis ce backoffice se faisait supprimer par ce
// filet de sécurité avant même d'être promu superAdmin.
export async function ensureUserDocument(user: FirebaseUser) {
  const ref = doc(db, "users", user.uid)
  const snapshot = await getDoc(ref)
  if (snapshot.exists()) return

  const refUserApp = await generateUniqueRefUserApp(user.uid)

  await setDoc(ref, {
    uid: user.uid,
    email: user.email ?? "",
    isApproved: false,
    accountType: "utilisateur",
    createdDate: serverTimestamp(),
    refUserApp,
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

// Comptes d'un périmètre de résidences (agence/agent, cf.
// useScopedResidenceIds) : résidents validés (memberResidencesIds, calculé
// côté serveur par sync_lot_tenants) + demandes de rattachement en attente
// (pendingLotResidenceIds). Avant, toute la collection users était chargée
// puis filtrée dans le navigateur : une agence pouvait donc lire tous les
// comptes Konodal. `scope` null = pas de restriction (superAdmin).
// array-contains-any accepte au plus 30 valeurs : une requête par tranche.
export function subscribeToUsersInScope(
  scope: Set<string> | null,
  onData: (users: KonodalUser[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  if (scope === null) return subscribeToUsers(onData, onError)
  const residenceIds = [...scope]
  if (residenceIds.length === 0) {
    onData([])
    return () => {}
  }
  const chunks: string[][] = []
  for (let i = 0; i < residenceIds.length; i += 30) chunks.push(residenceIds.slice(i, i + 30))
  const queries = chunks.flatMap((chunk) => [
    query(usersCollection, where("memberResidencesIds", "array-contains-any", chunk)),
    query(usersCollection, where("pendingLotResidenceIds", "array-contains-any", chunk)),
  ])
  const resultsByQuery: Map<string, KonodalUser>[] = queries.map(() => new Map())
  const received = queries.map(() => false)
  const emit = () => {
    if (!received.every(Boolean)) return
    const merged = new Map<string, KonodalUser>()
    for (const results of resultsByQuery) for (const [uid, user] of results) merged.set(uid, user)
    onData([...merged.values()])
  }
  const unsubscribes = queries.map((q, index) =>
    onSnapshot(
      q,
      (snapshot) => {
        resultsByQuery[index] = new Map(snapshot.docs.map((d) => [d.id, toKonodalUser(d)]))
        received[index] = true
        emit()
      },
      onError
    )
  )
  return () => unsubscribes.forEach((unsubscribe) => unsubscribe())
}

// Identité (audit sécurité point 9, étape 3) : date/lieu de naissance,
// sexe, nationalité déplacés dans users/{uid}/private/identity (lisible par
// le titulaire, son bailleur et le superAdmin). Pendant la transition, écrits
// aux deux endroits et relus d'abord dans la sous-fiche, avec repli sur
// users/{uid}.user - toujours le cas pour Agence/Agent, à qui la sous-fiche
// est refusée.
const IDENTITY_FIELDS = ["birthday", "sex", "nationality", "placeOfborn"] as const

function identityDoc(uid: string) {
  return doc(usersCollection, uid, "private", "identity")
}

async function withIdentity(user: KonodalUser): Promise<KonodalUser> {
  try {
    const snapshot = await getDoc(identityDoc(user.uid))
    const identity = snapshot.data()
    if (!identity) return user
    return {
      ...user,
      birthday: identity.birthday != null ? toDateOrNull(identity.birthday) : user.birthday,
      sex: (identity.sex as string | undefined) ?? user.sex,
      nationality: (identity.nationality as string | undefined) ?? user.nationality,
      placeOfborn: (identity.placeOfborn as string | undefined) ?? user.placeOfborn,
    }
  } catch {
    return user
  }
}

// Écrit dans la sous-fiche les champs d'identité présents dans `values`
// (clés "user.birthday" ou "birthday").
export async function writeIdentity(uid: string, values: Record<string, unknown>) {
  const identity: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(values)) {
    const field = key.startsWith("user.") ? key.slice("user.".length) : key
    if ((IDENTITY_FIELDS as readonly string[]).includes(field)) identity[field] = value
  }
  if (Object.keys(identity).length === 0) return
  await setDoc(identityDoc(uid), identity, { merge: true })
}

export function subscribeToUser(
  uid: string,
  onData: (user: KonodalUser | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(usersCollection, uid),
    (snapshot) => {
      if (!snapshot.exists()) return onData(null)
      void withIdentity(toKonodalUser(snapshot)).then(onData)
    },
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

// Statut distinct de isApproved (cf. types/user.ts) - vérification manuelle
// à part entière (pièce d'identité vérifiée ET données confirmées exactes),
// jamais posée ni retirée automatiquement par un flux app (contrairement à
// isApproved/rejectionReason, remis à zéro par submit_user.dart). Réservée
// isSuperAdmin comme le reste de la validation d'identité - déjà couvert par
// la règle update sans restriction de champ pour isSuperAdmin() côté
// firestore.rules (users/{uid}), aucune règle supplémentaire nécessaire.
// Certification manuelle (comptes certifiés avant le parcours app, ou
// retrait) : efface aussi un éventuel statut de demande en cours/refusée
// (certificationRequests, cf. lib/certification.ts), sans quoi le résident
// resterait affiché "Vérification en cours" après une décision manuelle.
export async function setUserCertified(uid: string, isCertified: boolean) {
  await updateDoc(doc(usersCollection, uid), {
    isCertified,
    certificationStatus: deleteField(),
    certificationRejectionReason: deleteField(),
  })
}

// Refus explicite avec motif (affiché au résident dans l'app mobile,
// NoApprovalPage) - distinct d'une simple révocation sans explication.
export async function rejectUser(uid: string, reason: string) {
  await updateDoc(doc(usersCollection, uid), { isApproved: false, rejectionReason: reason })
}

// Supprime le compte Auth (Admin SDK, functions/index.js:adminDeleteUser,
// réservé superAdmin côté serveur aussi - même garde-fou que côté BO) -
// déclenche automatiquement cleanupUserData (onDelete), qui purge
// Firestore/Storage/annonces/likes/commentaires. Pas de suppression
// Firestore directe possible depuis le client : firestore.rules interdit
// delete sur users/{uid} (jamais eu besoin jusqu'ici), et une suppression
// partielle laisserait des données orphelines (cf. l'incident du compte
// "fantôme" ressuscité par sync_lot_tenants plus tôt).
export async function deleteUserAccount(uid: string) {
  const call = httpsCallable<{ uid: string }, { success: boolean }>(functions, "adminDeleteUser")
  await call({ uid })
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
  const identity = {
    "user.sex": input.sex,
    "user.nationality": input.nationality,
    "user.placeOfborn": input.placeOfborn,
    "user.birthday": input.birthday ? Timestamp.fromDate(input.birthday) : null,
  }
  await updateDoc(doc(usersCollection, uid), {
    "user.name": input.name,
    "user.surname": input.surname,
    ...identity,
    "profil.phone": input.phone,
  })
  await writeIdentity(uid, identity)
}

// Correction isolée du téléphone (ResidentDetailPage) - contrairement à
// updateUserIdentity, ne touche QUE profil.phone : c'est ce qui permet à
// firestore.rules d'autoriser Agence/Agent sur ce champ précis
// (diff().affectedKeys().hasOnly(['profil'])) sans leur ouvrir le reste de
// l'identité (nom/prénom/pièce...), réservé superAdmin.
export async function updateUserPhone(uid: string, phone: string) {
  await updateDoc(doc(usersCollection, uid), { "profil.phone": phone })
}

export type OwnProfileInput = {
  name?: string
  surname?: string
  phone?: string
}

// Auto-édition de son propre profil BO (page /profil, tous rôles) - à ne
// pas confondre avec updateUserIdentity (correction d'un résident PAR un
// admin) : ici l'appelant modifie son propre compte, déjà couvert par
// firestore.rules (users/{uid}.update autorise isOwner(uid) tant
// qu'isApproved/accountType ne bougent pas). Champs optionnels : un compte
// agence n'a pas de name/surname personnel pertinent (cf. ProfilePage,
// responsable légal de la gérance à la place) - on n'écrit que ce qui est
// fourni.
export async function updateOwnProfile(uid: string, input: OwnProfileInput) {
  const update: Record<string, unknown> = {}
  if (input.name !== undefined) update["user.name"] = input.name
  if (input.surname !== undefined) update["user.surname"] = input.surname
  if (input.phone !== undefined) update["profil.phone"] = input.phone
  if (Object.keys(update).length === 0) return
  await updateDoc(doc(usersCollection, uid), update)
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
  // Lots enfants (parking/cave...) choisis en même temps que ce lot à
  // l'inscription, pas encore rattachés (traité côté serveur - sync_lot_approval
  // - une fois ce lot approuvé) : simple info pour le CS member, qui sinon
  // n'a aucune visibilité sur ce second lot réclamé avant d'approuver à
  // l'aveugle. Jamais modifié depuis le BO.
  pendingChildLotIds: string[]
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
            pendingChildLotIds: (data.pendingChildLotIds as string[] | undefined) ?? [],
          }
        })
      )
    },
    onError
  )
}

export type UserLotAttribution = {
  // "Résidence Principale ou secondaire"/"Investissement Locatif" côté
  // propriétaire, "Bail unique (personne seule)"/"Bail co-titulaire (en
  // concubinage)"/"Bail en colocation" côté locataire (type de bail) - même
  // champ Firestore, sémantique différente selon statutResident (cf.
  // step2.dart côté app mobile).
  intendedFor: string
  statutResident: string
}

// Détail de l'attribution d'UN utilisateur sur un lot précis (LotDetailPage,
// cartes Propriétaire/Locataire) - contrairement à subscribeToUserLots
// (tous les lots d'UN utilisateur), ici on part du lot pour retrouver
// l'attribution d'un des uids listés dans idProprietaire/idLocataire.
export async function getUserLotAttribution(
  uid: string,
  lotId: string
): Promise<UserLotAttribution | null> {
  const snapshot = await getDoc(doc(db, "users", uid, "lots", lotId))
  if (!snapshot.exists()) return null
  const data = snapshot.data()
  return {
    intendedFor: (data.intendedFor as string) ?? "",
    statutResident: (data.statutResident as string) ?? "",
  }
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
// Recherche un compte par email exact (ResidentDetailPage "Ajouter un lot",
// LotDetailPage "Ajouter" propriétaire/locataire) - un CS member/superAdmin
// ne connaît généralement que l'email du résident à rattacher, pas son uid.
export async function findUserByEmail(email: string): Promise<KonodalUser | null> {
  const trimmed = email.trim()
  if (!trimmed) return null
  const snapshot = await getDocs(query(usersCollection, where("email", "==", trimmed)))
  return snapshot.empty ? null : toKonodalUser(snapshot.docs[0])
}

export async function resolveUsersByUids(uids: string[]): Promise<KonodalUser[]> {
  const unique = [...new Set(uids)]
  const snapshots = await Promise.all(unique.map((uid) => getDoc(doc(usersCollection, uid))))
  return snapshots.filter((snap) => snap.exists()).map(toKonodalUser)
}

// Idempotent à dessein : ré-écrire `true` alors que c'est déjà `true` reste
// utile - ça redéclenche la Cloud Function sync_lot_approval si elle avait
// échoué la première fois faute de users/{uid}.isApproved (cf. mémoire du
// projet sur l'ordre approbation identité -> approbation lot).
export async function approveUserLot(uid: string, lotId: string) {
  await updateDoc(doc(db, "users", uid, "lots", lotId), { isApprovedLot: true })
}
