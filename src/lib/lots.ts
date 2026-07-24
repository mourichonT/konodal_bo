import {
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
        ...(d.data() as Partial<Omit<Lot, "id">>),
        id: d.id,
      }))
      lots.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
      onData(lots)
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
}

// Mêmes clés que Lot.toJsonForDb() côté app mobile (connectkasa) : on
// n'écrit que les champs gérés depuis cet écran, jamais idLocataire,
// syndicAgency... pour ne pas écraser des données gérées ailleurs
// (attribution de lot). Le rattachement parent-enfant (parentLotId) a sa
// propre fonction dédiée, linkLot, plus bas.
function toFirestoreLotData(input: LotInput) {
  return {
    ...(input.refLot ? { refLot: input.refLot } : {}),
    ...(input.batiment ? { batiment: input.batiment } : {}),
    ...(input.lot ? { lot: input.lot } : {}),
    ...(input.typeLot ? { typeLot: input.typeLot } : {}),
    isLinkable: input.isLinkable,
    order: input.order,
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
