import {
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { getDownloadURL, ref, uploadBytes } from "firebase/storage"
import { db, functions, storage } from "@/firebase"
import { findUserByEmail } from "@/lib/users"
import { defaultIsLinkableForType } from "@/types/lot"
import { parseStructureLabel, structureLabel } from "@/lib/lotImportExport"
import type {
  ResidenceRequest,
  ResidenceRequestAttachment,
  ResidenceRequestBuilding,
  ResidenceRequestStatus,
} from "@/types/residenceRequest"

const requestsCollection = collection(db, "residenceRequests")

export const REQUEST_STATUS_LABEL: Record<ResidenceRequestStatus, string> = {
  pending: "En attente",
  approved: "Validée",
  rejected: "Refusée",
}

export const REQUEST_STATUS_BADGE_CLASS: Record<ResidenceRequestStatus, string> = {
  pending: "border-[oklch(85%_0.1_75)] bg-[oklch(96%_0.04_75)] text-[oklch(40%_0.1_60)]",
  approved: "border-[oklch(85%_0.06_150)] bg-[oklch(95%_0.04_150)] text-[oklch(38%_0.09_155)]",
  rejected: "border-[oklch(88%_0.04_25)] bg-[oklch(96%_0.02_25)] text-[oklch(45%_0.12_25)]",
}

export function subscribeToResidenceRequests(
  onData: (requests: ResidenceRequest[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(requestsCollection, orderBy("createdAt", "desc")),
    (snapshot) =>
      onData(snapshot.docs.map((d) => ({ ...(d.data() as Omit<ResidenceRequest, "id">), id: d.id }))),
    onError
  )
}

export function subscribeToResidenceRequest(
  id: string,
  onData: (request: ResidenceRequest | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(requestsCollection, id),
    (snapshot) =>
      onData(snapshot.exists() ? { ...(snapshot.data() as Omit<ResidenceRequest, "id">), id: snapshot.id } : null),
    onError
  )
}

// Bâtiments de la demande avec leur libellé "<type> <nom>" (= Lot.batiment).
// Demandes sans `buildings` (premières versions du formulaire) : déduits des
// lots, libellé découpé comme à l'import de lots (parseStructureLabel),
// "Bâtiment" + libellé entier à défaut.
export function requestBuildings(request: ResidenceRequest): (ResidenceRequestBuilding & { label: string })[] {
  const buildings: ResidenceRequestBuilding[] = request.buildings?.length
    ? request.buildings
    : [...new Set(request.lots.map((l) => l.batiment))].map(
        (label) => parseStructureLabel(label) ?? { type: "Bâtiment", name: label }
      )
  return buildings.map((b) => ({ ...b, label: structureLabel(b) }))
}

// Compte du demandeur : uid vérifié à l'envoi (formulaire connecté), sinon
// recherche par email pour les premières demandes envoyées sans connexion.
// null = aucun compte, la demande ne peut pas être validée.
export async function requesterAccountUid(request: ResidenceRequest): Promise<string | null> {
  if (request.requester.uid) return request.requester.uid
  if (!request.requester.email) return null
  return (await findUserByEmail(request.requester.email))?.uid ?? null
}

// Référence de lot unique dans la résidence (importLots/lotImportExport
// supposent refLot unique) : le numéro seul, préfixé du bâtiment uniquement
// quand le même numéro existe dans plusieurs bâtiments.
export function lotRefs(lots: ResidenceRequest["lots"]): string[] {
  const count = new Map<string, number>()
  for (const lot of lots) count.set(lot.lot.toLowerCase(), (count.get(lot.lot.toLowerCase()) ?? 0) + 1)
  return lots.map((lot) => ((count.get(lot.lot.toLowerCase()) ?? 0) > 1 ? `${lot.batiment}-${lot.lot}` : lot.lot))
}

// Mail best effort via send_email_callable (même canal que
// sendCsMemberInviteEmail, lib/residences.ts) : la décision est déjà
// enregistrée, un échec d'envoi ne la remet pas en cause.
async function notifyRequester(to: string, subject: string, body: string): Promise<boolean> {
  try {
    const call = httpsCallable<{ to: string; subject: string; body: string }, { success: boolean }>(
      functions,
      "send_email_callable"
    )
    return (await call({ to, subject, body })).data.success
  } catch (err) {
    console.error("notifyRequester: échec de l'envoi", err)
    return false
  }
}

// Crée la résidence (offre gratuite : pas de geranceRef, tantièmes à 0, pas
// de clés de charge), un bâtiment par libellé distinct et les lots - mêmes
// champs que createResidence (lib/residences.ts), createStructure
// (lib/structures.ts) et createLot (lib/lots.ts). Le demandeur devient
// membre du CS s'il a déjà un compte avec cet email (csmembers, synchronisé
// vers users/{uid}.csMemberResidencesIds par sync_cs_member_residences) ;
// totalLot est recalculé par sync_lot_count à l'écriture des lots.
// `residence` : nom et adresse éventuellement corrigés depuis la page
// d'examen (ResidenceRequestDetailPage) avant validation - enregistrés aussi
// sur la demande pour garder trace de ce qui a été réellement créé.
// Rattachements (lot.parent) écrits dès la création (parentLotId +
// groupedWithParent, comme linkLot/importLots) : ids générés d'avance, lots
// principaux écrits avant les lots rattachés pour que sync_lot_tenants
// trouve le parent déjà en base.
export async function approveResidenceRequest(
  request: ResidenceRequest,
  processedBy: string,
  residence: ResidenceRequest["residence"] = request.residence
): Promise<{ residenceId: string; csMemberUid: string | null; emailSent: boolean }> {
  const csMemberUid = await requesterAccountUid(request)
  if (!csMemberUid) {
    throw new Error("demande sans compte Konodal : la résidence n'aurait aucun membre du CS")
  }

  const residenceRef = doc(collection(db, "residences"))
  const buildings = requestBuildings(request)
  const refs = lotRefs(request.lots)
  const lotKey = (batiment: string, lot: string) => `${batiment.toLowerCase()}|${lot.toLowerCase()}`
  const lotIds = request.lots.map(() => doc(collection(db, "residences", residenceRef.id, "lots")).id)
  const idByKey = new Map(request.lots.map((l, i) => [lotKey(l.batiment, l.lot), lotIds[i]]))
  const orderedLots = request.lots
    .map((lot, order) => ({ lot, order }))
    .sort((a, b) => Number(!!a.lot.parent) - Number(!!b.lot.parent))

  type BatchOperation = (batch: ReturnType<typeof writeBatch>) => void
  const operations: BatchOperation[] = [
    (batch) =>
      batch.set(residenceRef, {
        name: residence.name,
        address: { ...residence.address, codeQualite: "60" },
        totalLot: 0,
        csmembers: csMemberUid ? [csMemberUid] : [],
      }),
    ...buildings.map(
      ({ type, name }, order): BatchOperation =>
        (batch) =>
          batch.set(doc(collection(db, "residences", residenceRef.id, "structures")), {
            name,
            type,
            etage: [],
            hasUnderground: false,
            elements: [],
            order,
            hasDifferentSyndic: false,
            syndicAgency: null,
            geranceRef: null,
          })
    ),
    ...orderedLots.map(
      ({ lot, order }): BatchOperation =>
        (batch) => {
          const id = lotIds[order]
          const parentLotId = lot.parent ? idByKey.get(lotKey(lot.parent.batiment, lot.parent.lot)) : undefined
          batch.set(doc(db, "residences", residenceRef.id, "lots", id), {
            id,
            refLot: refs[order],
            batiment: lot.batiment,
            lot: lot.lot,
            typeLot: lot.typeLot,
            isLinkable: defaultIsLinkableForType(lot.typeLot),
            order,
            tantiemes: 0,
            idProprietaire: [],
            ...(parentLotId ? { parentLotId, groupedWithParent: true } : {}),
          })
        }
    ),
  ]
  // La résidence est écrite dans le premier lot d'écritures (elle précède
  // structures et lots) ; chunk à 400 comme importLots (limite Firestore 500).
  for (let i = 0; i < operations.length; i += 400) {
    const batch = writeBatch(db)
    operations.slice(i, i + 400).forEach((operation) => operation(batch))
    await batch.commit()
  }

  await updateDoc(doc(requestsCollection, request.id), {
    status: "approved",
    residence,
    residenceId: residenceRef.id,
    csMemberUid,
    processedBy,
    processedAt: serverTimestamp(),
  })

  const emailSent = await notifyRequester(
    request.requester.email,
    `Votre résidence ${residence.name} est ouverte sur Konodal`,
    `Bonjour ${request.requester.firstName},\n\n` +
      `Bonne nouvelle : la résidence ${residence.name} est maintenant ouverte sur Konodal.\n\n` +
      "Vous en êtes membre du conseil syndical. " +
      "Invitez vos voisins à la rejoindre sur app.konodal.com : le kit d'affichage (sticker, flyer, triptyque) " +
      "est disponible sur konodal.com/kit.\n\nL'équipe Konodal"
  )
  return { residenceId: residenceRef.id, csMemberUid, emailSent }
}

export async function rejectResidenceRequest(
  request: ResidenceRequest,
  reason: string,
  processedBy: string
): Promise<{ emailSent: boolean }> {
  await updateDoc(doc(requestsCollection, request.id), {
    status: "rejected",
    rejectionReason: reason,
    processedBy,
    processedAt: serverTimestamp(),
  })
  const emailSent = await notifyRequester(
    request.requester.email,
    `Votre demande d'inscription pour ${request.residence.name}`,
    `Bonjour ${request.requester.firstName},\n\n` +
      `Nous n'avons pas pu donner suite à votre demande d'inscription de la résidence ${request.residence.name}` +
      (reason ? ` : ${reason}` : ".") +
      "\n\nPour toute question, répondez simplement à cet email ou écrivez-nous à contact@konodal.com.\n\nL'équipe Konodal"
  )
  return { emailSent }
}

// Email libre au demandeur pour obtenir des informations complémentaires,
// gardé dans l'historique de la demande (messages) même si l'envoi échoue
// (emailSent=false) pour que l'échec reste visible.
export async function sendRequestEmail(
  request: ResidenceRequest,
  subject: string,
  body: string,
  sentBy: string
): Promise<boolean> {
  const emailSent = await notifyRequester(request.requester.email, subject, body)
  await updateDoc(doc(requestsCollection, request.id), {
    messages: arrayUnion({ subject, body, sentAt: Timestamp.now(), sentBy, emailSent }),
  })
  return emailSent
}

// Pièce ajoutée depuis le BO (document reçu par email...) - même dossier
// que les règles Storage réservent au superAdmin (residenceRequestFiles).
export async function addRequestAttachment(request: ResidenceRequest, file: File): Promise<void> {
  const safeName = file.name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\w.-]+/g, "_")
    .slice(-80)
  const path = `residenceRequestFiles/${request.id}/${Date.now()}-${safeName}`
  await uploadBytes(ref(storage, path), file, { contentType: file.type || undefined })
  const attachment: ResidenceRequestAttachment = {
    path,
    name: file.name,
    size: file.size,
    contentType: file.type,
    addedBy: "backoffice",
    addedAt: Timestamp.now(),
  }
  await updateDoc(doc(requestsCollection, request.id), { attachments: arrayUnion(attachment) })
}

export function requestAttachmentUrl(attachment: ResidenceRequestAttachment): Promise<string> {
  return getDownloadURL(ref(storage, attachment.path))
}
