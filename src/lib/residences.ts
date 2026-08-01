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
import logoVertical from "@/assets/logo-vertical.png?url&no-inline"

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

// Même gabarit d'en-tête que buildInterventionEmailHtml
// (EvenementDetailPage.tsx) - logo + bandeau vert #48775B (rgba(72,119,91,1)
// = même couleur), pour uniformiser tous les mails envoyés depuis ce
// backoffice plutôt qu'un texte "KONODAL" nu.
function csMemberInviteEmailHtml(residenceName: string): string {
  const logoUrl = new URL(logoVertical, window.location.origin).href
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4;">
    <table align="center" width="600" style="background-color: #ffffff; border-collapse: collapse; margin-top: 20px;">
        <tr>
        <td style="background-color: rgba(72, 119, 91, 1); color: #ffffff; text-align: center; padding: 30px 20px">
            <img src="${logoUrl}" alt="KONODAL-Logo" width="90" style="max-width: 25%">
            <h2 style="margin: 30px 0 0; font-size: 20px">Invitation au Conseil Syndical</h2>
        </td>
        </tr>
        <tr>
        <td style="padding: 30px 30px; color: #333333;">
            <p>Bonjour,</p>
            <p>Vous avez été ajouté(e) au <strong>Conseil Syndical</strong> de la résidence <strong>${residenceName}</strong>.</p>
            <p>Connectez-vous à l'application KONODAL pour accéder aux fonctionnalités réservées aux membres du CS (documents de copropriété, suivi des sinistres...).</p>
            <p style="font-size: 12px; color: #666;">En cas de question, contactez votre syndic.</p>
        </td>
        </tr>
    </table>
    </body>
    </html>
  `
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
