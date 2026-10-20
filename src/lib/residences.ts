import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { db, functions } from "@/firebase"
import type { Address, GeranceRef, Residence } from "@/types/residence"
// ?url&no-inline : cf. commentaire équivalent dans lib/events.ts
// (GERANCE_PLACEHOLDER_LOGO_URL) - garantit une vraie URL joignable depuis
// une boîte mail, jamais inlinée en base64 par Vite.
import { APP_URL, emailButtonHtml, emailContactHtml, escapeHtml, konodalEmailHtml } from "@/lib/emailTemplate"

const residencesCollection = collection(db, "residences")

export function subscribeToResidences(
  onData: (residences: Residence[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(residencesCollection, orderBy("name"))
  return onSnapshot(
    q,
    (snapshot) => {
      // `id` posé après le spread : même précaution que subscribeToLots
      // (lib/lots.ts) - un champ `id` stocké dans le document divergent du
      // vrai id Firestore écraserait sinon silencieusement la valeur fiable.
      onData(
        snapshot.docs.map((d) => ({ ...(d.data() as Omit<Residence, "id">), id: d.id }))
      )
    },
    onError
  )
}

export function subscribeToResidence(
  id: string,
  onData: (residence: Residence | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(residencesCollection, id),
    (snapshot) => {
      onData(
        snapshot.exists() ? { ...(snapshot.data() as Omit<Residence, "id">), id: snapshot.id } : null
      )
    },
    onError
  )
}

// Périmètre d'un compte agence/agent (RBAC) : résidences dont geranceRef
// pointe vers CETTE gérance - requête indexée directe plutôt qu'un champ
// dénormalisé gerance.residenceIds (évite une double écriture à maintenir
// à chaque réassignation de gérance sur une résidence, cf. discussion de
// cadrage RBAC). isProfessionnelResidence côté firestore.rules vérifie la
// même relation, dans l'autre sens, résidence par résidence.
export function subscribeToResidencesForGerance(
  geranceId: string,
  onData: (residences: Residence[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(residencesCollection, where("geranceRef.geranceId", "==", geranceId))
  return onSnapshot(
    q,
    (snapshot) =>
      onData(snapshot.docs.map((d) => ({ ...(d.data() as Omit<Residence, "id">), id: d.id }))),
    onError
  )
}

export type ResidenceInput = {
  name: string
  address: Address
  mail_contact?: string
}

// geranceRef : requis côté règle Firestore pour qu'une Agence (pas un
// simple Agent) crée sa propre résidence - isProfessionnelResidence()
// dépend de ce champ, une résidence créée sans lui resterait invisible/
// non modifiable ensuite pour son créateur (ni CS member, ni Super Admin,
// ni Professionnel tant que geranceRef est absent). Absent pour une
// création Super Admin (assignation de gérance faite séparément depuis la
// fiche résidence, cf. updateResidenceGeranceRef).
export async function createResidence(input: ResidenceInput, geranceRef?: GeranceRef) {
  await addDoc(residencesCollection, {
    ...input,
    totalLot: 0,
    ...(geranceRef ? { geranceRef } : {}),
  })
}

export async function updateResidence(id: string, input: ResidenceInput) {
  await updateDoc(doc(db, "residences", id), { ...input })
}

// Liste réécrite en entier à chaque ajout ou suppression, enregistrée
// aussitôt - même écriture que l'app mobile (management_res_info_g.dart,
// _saveAlternateAddresses).
export async function updateResidenceAlternateAddresses(id: string, addresses: Address[]) {
  await updateDoc(doc(db, "residences", id), { alternateAddresses: addresses })
}

// Bilan renvoyé par adminDeleteResidence (konodal_app/functions/index.js) :
// en dryRun, sert à la fenêtre de confirmation ; après suppression, deleted.
export type ResidenceDeletionSummary = {
  name: string
  lots: number
  residents: number
  csMembers: number
  accounts: number
  posts: number
  documents: number
  votes: number
  subscribed: boolean
  deleted?: boolean
}

// Suppression complète d'une résidence (superAdmin) : arborescence
// residences/{id}, fichiers Storage, lots et listes des comptes rattachés,
// jetons et marqueurs liés. Faite côté serveur (Admin SDK) : firestore.rules
// interdit au client, même superAdmin, de supprimer plusieurs sous-
// collections (votes clos, chats, charte, facturation...). Refusée par le
// serveur tant qu'un abonnement CS avancé est en cours, et si confirmName
// n'est pas exactement le nom de la résidence.
export async function deleteResidence(
  residenceId: string,
  options: { dryRun: true } | { confirmName: string }
): Promise<ResidenceDeletionSummary> {
  const call = httpsCallable<
    { residenceId: string; dryRun?: boolean; confirmName?: string },
    ResidenceDeletionSummary
  >(functions, "adminDeleteResidence", { timeout: 540_000 })
  return (await call({ residenceId, ...options })).data
}

export async function updateResidenceGeo(id: string, lat: number, lng: number) {
  await updateDoc(doc(db, "residences", id), { lat, lng })
}

// Rattache/détache la gérance qui gère cette résidence - condition
// nécessaire pour qu'un compte agence/agent (RBAC) voie quoi que ce soit
// (isProfessionnelResidence/isProfessionnelLot côté firestore.rules lisent
// ce champ). deleteField() plutôt que null : la règle teste
// 'geranceRef' in residence, qui resterait vraie avec une valeur null et
// ferait échouer l'accès à .serviceType ensuite.
export async function updateResidenceGeranceRef(id: string, geranceRef: GeranceRef | null) {
  await updateDoc(doc(db, "residences", id), {
    geranceRef: geranceRef ?? deleteField(),
  })
}

// Gabarit commun des mails (lib/emailTemplate.ts).
function csMemberInviteEmailHtml(residenceName: string): string {
  return konodalEmailHtml({
    title: "Invitation au Conseil Syndical",
    bodyHtml: `
            <p>Bonjour,</p>
            <p>Vous avez été ajouté(e) au <strong>Conseil Syndical</strong> de la résidence <strong>${escapeHtml(residenceName)}</strong>.</p>
            <p>Connectez-vous à l'application KONODAL pour accéder aux fonctionnalités réservées aux membres du CS (documents de copropriété, suivi des sinistres...).</p>
        ${emailButtonHtml(APP_URL, "Ouvrir Konodal")}
        ${emailContactHtml}`,
  })
}

// Envoie une notification à l'adresse mail déjà connue de ce compte (pas une
// invitation à créer un compte - le propriétaire en a déjà un, cf. décision
// de cadrage sur setCsMember) - via send_email_callable (functions_python),
// déjà déployée, aucun nouvel endpoint nécessaire. Échec avalé (log console
// seulement) : l'ajout à csmembers, lui, a déjà réussi et ne doit pas être
// remis en cause par un problème d'envoi d'email.
async function sendCsMemberInviteEmail(email: string, residenceName: string) {
  try {
    const call = httpsCallable<
      { to: string; subject: string; body: string; html: string },
      { success: boolean; error: string | null }
    >(functions, "send_email_callable")
    const result = await call({
      to: email,
      subject: `Vous êtes membre du Conseil Syndical de ${residenceName}`,
      body: `Vous avez été ajouté(e) au Conseil Syndical de la résidence ${residenceName}. Connectez-vous à l'application KONODAL pour en savoir plus.`,
      html: csMemberInviteEmailHtml(residenceName),
    })
    return result.data.success
  } catch (err) {
    console.error("sendCsMemberInviteEmail: échec de l'envoi", err)
    return false
  }
}

// Invite/retire un membre du Conseil Syndical (residences/{id}.csmembers,
// tableau d'uid) - synchronisé automatiquement vers
// users/{uid}.csMemberResidencesIds par sync_cs_member_residences
// (functions_python/main.py, déjà déployée), rien d'autre à écrire ici.
// Choix explicite : uniquement parmi les propriétaires déjà déclarés sur un
// lot de CETTE résidence (idProprietaire), pas les locataires - cf. décision
// de cadrage. firestore.rules (residences/{id}.update) autorise déjà
// isCsMember/isSuperAdmin/isProfessionnelResidence sans restriction de champ,
// donc superAdmin ET agence/agent peuvent tous les trois inviter.
// email/residenceName : uniquement fournis lors d'un ajout (member=true),
// pour notifier le nouveau membre - jamais utilisés au retrait.
export async function setCsMember(
  residenceId: string,
  uid: string,
  member: boolean,
  email?: string,
  residenceName?: string
): Promise<{ emailSent: boolean }> {
  await updateDoc(doc(db, "residences", residenceId), {
    csmembers: member ? arrayUnion(uid) : arrayRemove(uid),
  })
  if (member && email && residenceName) {
    const emailSent = await sendCsMemberInviteEmail(email, residenceName)
    return { emailSent }
  }
  return { emailSent: false }
}
