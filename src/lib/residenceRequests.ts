import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { db, functions } from "@/firebase"
import { findUserByEmail } from "@/lib/users"
import { defaultIsLinkableForType } from "@/types/lot"
import { parseStructureLabel, structureLabel } from "@/lib/lotImportExport"
import type { ResidenceRequest, ResidenceRequestBuilding } from "@/types/residenceRequest"

const requestsCollection = collection(db, "residenceRequests")

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

// Référence de lot unique dans la résidence (importLots/lotImportExport
// supposent refLot unique) : le numéro seul, préfixé du bâtiment uniquement
// quand le même numéro existe dans plusieurs bâtiments.
function lotRefs(lots: ResidenceRequest["lots"]): string[] {
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
export async function approveResidenceRequest(
  request: ResidenceRequest,
  processedBy: string
): Promise<{ residenceId: string; csMemberUid: string | null; emailSent: boolean }> {
  const requester = await findUserByEmail(request.requester.email)
  const csMemberUid = requester?.uid ?? null

  const residenceRef = doc(collection(db, "residences"))
  const buildings = requestBuildings(request)
  const refs = lotRefs(request.lots)

  type BatchOperation = (batch: ReturnType<typeof writeBatch>) => void
  const operations: BatchOperation[] = [
    (batch) =>
      batch.set(residenceRef, {
        name: request.residence.name,
        address: { ...request.residence.address, codeQualite: "60" },
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
    ...request.lots.map(
      (lot, order): BatchOperation =>
        (batch) => {
          const lotRef = doc(collection(db, "residences", residenceRef.id, "lots"))
          batch.set(lotRef, {
            id: lotRef.id,
            refLot: refs[order],
            batiment: lot.batiment,
            lot: lot.lot,
            typeLot: lot.typeLot,
            isLinkable: defaultIsLinkableForType(lot.typeLot),
            order,
            tantiemes: 0,
            idProprietaire: [],
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
    residenceId: residenceRef.id,
    csMemberUid,
    processedBy,
    processedAt: serverTimestamp(),
  })

  const emailSent = await notifyRequester(
    request.requester.email,
    `Votre résidence ${request.residence.name} est ouverte sur Konodal`,
    `Bonjour ${request.requester.firstName},\n\n` +
      `Bonne nouvelle : la résidence ${request.residence.name} est maintenant ouverte sur Konodal.\n\n` +
      (csMemberUid
        ? "Vous en êtes membre du conseil syndical. "
        : "Créez votre compte avec cette adresse email pour la rejoindre. ") +
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
