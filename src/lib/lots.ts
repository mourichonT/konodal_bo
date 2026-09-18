import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore"
import { db } from "@/firebase"
import type { Lot } from "@/types/lot"
import type { LotImportInput } from "@/lib/lotImportExport"

function lotsCollection(residenceId: string) {
  return collection(db, "residences", residenceId, "lots")
}

// Pas de orderBy("order") côté Firestore à dessein - même piège que
// subscribeToStructures/subscribeToUsers (exclusion silencieuse des
// documents sans le champ). Tri côté client, ceux sans `order` passent
// après (Infinity).
export function subscribeToLots(
  residenceId: string,
  onData: (lots: Lot[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(lotsCollection(residenceId))
  return onSnapshot(
    q,
    (snapshot) => {
      // `id: d.id` APRÈS le spread : le champ `id` stocké dans le document
      // (écrit par l'app mobile, cf. commentaire "ID corrompu par des
      // espaces parasites" dans firestore_lot_repository.dart -
      // createOrUpdateLot) peut diverger du vrai id du document (espace
      // parasite, valeur jamais migrée...). Le laisser gagner sur d.id
      // faisait pointer updateLot() vers un chemin Firestore inexistant
      // (doc "fantôme"), recréant silencieusement le lot en double à chaque
      // enregistrement - même précaution que _postFromDoc côté app
      // (firestore_post_repository.dart) pour la même classe de bug.
      const lots = snapshot.docs.map((d) => ({
        refLot: "",
        batiment: "",
        lot: "",
        typeLot: "",
        isLinkable: false,
        idProprietaire: [],
        idLocataire: [],
        tantiemes: 0,
        ...(d.data() as Partial<Omit<Lot, "id">>),
        id: d.id,
      }))
      lots.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
      onData(lots)
    },
    onError
  )
}

// Lot unique (LotDetailPage) - même précaution `id` posé après le spread
// que subscribeToLots ci-dessus.
export function subscribeToLot(
  residenceId: string,
  lotId: string,
  onData: (lot: Lot | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "residences", residenceId, "lots", lotId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null)
        return
      }
      onData({
        refLot: "",
        batiment: "",
        lot: "",
        typeLot: "",
        isLinkable: false,
        idProprietaire: [],
        idLocataire: [],
        tantiemes: 0,
        ...(snapshot.data() as Partial<Omit<Lot, "id">>),
        id: snapshot.id,
      })
    },
    onError
  )
}

export type LotInput = {
  refLot: string
  batiment: string
  lot: string
  typeLot: string
  isLinkable: boolean
  order: number
  // Tantième général du lot (loi de 1965) - cf. Lot.tantiemes, types/lot.ts.
  tantiemes: number
}

// Mêmes clés que Lot.toJsonForDb() côté app mobile (connectkasa) : on
// n'écrit que les champs gérés depuis cet écran, jamais idLocataire,
// syndicAgency... pour ne pas écraser des données gérées ailleurs
// (attribution de lot). Le rattachement parent-enfant (parentLotId) a sa
// propre fonction dédiée, linkLot, plus bas. `tantiemes` toujours écrit, y
// compris à 0 - même choix explicite que côté app mobile (toJsonForDb),
// jamais omis silencieusement contrairement aux champs texte ci-dessus.
function toFirestoreLotData(input: LotInput) {
  return {
    ...(input.refLot ? { refLot: input.refLot } : {}),
    ...(input.batiment ? { batiment: input.batiment } : {}),
    ...(input.lot ? { lot: input.lot } : {}),
    ...(input.typeLot ? { typeLot: input.typeLot } : {}),
    isLinkable: input.isLinkable,
    order: input.order,
    tantiemes: input.tantiemes,
  }
}

// Nouveau lot : ID auto-généré, reporté dans le champ `id` du document lui
// même (convention Lot.id côté app mobile). Retourne l'id pour permettre un
// ajout de ligne enregistré immédiatement côté BO (LotsSection) - plus de
// brouillon local sans id qui attendrait un clic "Enregistrer" séparé.
export async function createLot(residenceId: string, input: LotInput): Promise<string> {
  const ref = doc(lotsCollection(residenceId))
  await setDoc(ref, { ...toFirestoreLotData(input), id: ref.id, idProprietaire: [] })
  return ref.id
}

export async function updateLot(residenceId: string, id: string, input: LotInput) {
  await setDoc(doc(db, "residences", residenceId, "lots", id), toFirestoreLotData(input), {
    merge: true,
  })
}

// Réorganisation click-and-déplace (LotsSection) - même patron que
// reorderStructures (lib/structures.ts) : écrit `order` en une seule fois
// pour toute la liste, appelé immédiatement après un drop plutôt qu'au
// moment d'un enregistrement groupé.
export async function reorderLots(residenceId: string, orderedIds: string[]) {
  const batch = writeBatch(db)
  orderedIds.forEach((id, index) => {
    batch.update(doc(db, "residences", residenceId, "lots", id), { order: index })
  })
  await batch.commit()
}

export async function deleteLot(residenceId: string, id: string) {
  await deleteDoc(doc(db, "residences", residenceId, "lots", id))
}

// Import en masse (LotImportDialog) - les lignes ont déjà été validées et
// dédupliquées contre l'existant côté client (validateLotImportRows,
// lib/lotImportExport.ts) avant d'arriver ici : aucune vérification
// supplémentaire, uniquement des créations (jamais d'update, donc jamais
// d'écrasement d'un lot déjà en base). `startOrder` = nombre de lots déjà
// affichés au moment de la confirmation, pour ajouter les nouveaux à la
// suite plutôt que de réécraser l'ordre existant. Chunké à 400 (limite
// Firestore : 500 opérations par batch).
export async function importLots(
  residenceId: string,
  inputs: LotImportInput[],
  startOrder: number
): Promise<void> {
  for (let i = 0; i < inputs.length; i += 400) {
    const chunk = inputs.slice(i, i + 400)
    const batch = writeBatch(db)
    chunk.forEach((input, j) => {
      const ref = doc(lotsCollection(residenceId))
      batch.set(ref, {
        ...toFirestoreLotData({ ...input, order: startOrder + i + j }),
        id: ref.id,
        idProprietaire: [],
      })
    })
    await batch.commit()
  }
}

// Rattache (ou détache si parentLotId est null) un lot dépendant
// (isLinkable=true, ex: parking/cave) à un lot principal (ex: appartement) -
// déclenche sync_lot_tenants côté serveur (functions_python/main.py), qui
// recopie idProprietaire du parent vers l'enfant (et idLocataire puisque
// groupedWithParent est toujours vrai ici, pas de granularité exposée côté
// BO). Action consciente, pas un simple champ descriptif - fonction séparée
// de updateLot/toFirestoreLotData à dessein.
export async function linkLot(residenceId: string, childLotId: string, parentLotId: string | null) {
  await updateDoc(doc(db, "residences", residenceId, "lots", childLotId), {
    parentLotId: parentLotId ?? deleteField(),
    groupedWithParent: parentLotId !== null,
  })
}

export type LotRole = "Propriétaire" | "Locataire"

// Rattache un uid comme propriétaire/locataire d'un lot depuis le BO
// (ResidentDetailPage "Ajouter un lot", LotDetailPage "Ajouter") - écrit
// directement idProprietaire/idLocataire (réservé isSuperAdmin côté
// firestore.rules, jamais ouvert à Agence/Agent sur ce champ précis,
// contrairement à isApprovedLot) plutôt que de créer users/{uid}/lots
// nous-mêmes (create y exige isOwner(uid), impossible depuis le BO). La
// Cloud Function sync_lot_tenants (functions_python/main.py) réagit à cet
// ArrayUnion et crée elle-même users/{uid}/lots/{lotId} (isApprovedLot:
// true) si besoin - même mécanisme que l'ajout d'un locataire par son
// propriétaire côté app.
export async function grantLotRole(
  residenceId: string,
  lotId: string,
  uid: string,
  role: LotRole
) {
  const field = role === "Propriétaire" ? "idProprietaire" : "idLocataire"
  await updateDoc(doc(db, "residences", residenceId, "lots", lotId), {
    [field]: arrayUnion(uid),
  })
}

// Retire un uid de idProprietaire/idLocataire (même garde côté règles que
// grantLotRole ci-dessus) - sync_lot_tenants archive alors users/{uid}/
// lots/{lotId} (et ses documents) sous lotsOld avant de le supprimer,
// exactement comme une révocation faite par le propriétaire lui-même côté
// app. Ne PAS supprimer users/{uid}/lots/{lotId} directement depuis le BO :
// ce document ne serait alors plus dans idProprietaire/idLocataire côté
// résidence, mais l'inverse resterait vrai (incohérence), et l'archivage
// lotsOld n'aurait pas lieu.
export async function revokeLotRole(
  residenceId: string,
  lotId: string,
  uid: string,
  role: LotRole
) {
  const field = role === "Propriétaire" ? "idProprietaire" : "idLocataire"
  await updateDoc(doc(db, "residences", residenceId, "lots", lotId), {
    [field]: arrayRemove(uid),
  })
}
