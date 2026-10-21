import { structureTypeOptions } from "@/types/structure"

export const typeLotOptions = [
  "Appartement",
  "Maison/Villa",
  "Place de parking",
  "Box/Garage",
  "Cave",
  "Grenier/Combles",
  "Local commercial",
  "Bureau",
  "Cellier",
  "Jardin privatif",
  "Atelier",
  "Hangar/Entrepôt",
  "Terrain nu",
]

// Un lot dépendant (parking, cave...) est rattachable par défaut à un lot
// principal ; un logement/local principal ne l'est pas. Reflète
// Lot.defaultIsLinkableForType côté app mobile (connectkasa).
const mainDwellingTypes = new Set([
  "Appartement",
  "Maison/Villa",
  "Local commercial",
  "Bureau",
  "Terrain nu",
  "Hangar/Entrepôt",
])

export function defaultIsLinkableForType(typeLot: string): boolean {
  return !mainDwellingTypes.has(typeLot)
}

// Nom du bâtiment sans son type de structure : « Bâtiment D » → « D »,
// « Souterrain Parking » → « Parking » (batiment = « <type> <nom> », cf.
// structureTypeOptions).
export function buildingShortName(batiment: string): string {
  const name = (batiment ?? "").trim()
  const type = structureTypeOptions.find((t) => name.startsWith(`${t} `))
  return type ? name.slice(type.length + 1) : name
}

// Libellé lisible d'un lot, ex. « Réf. 126 — D03 · Appartement » : référence
// du règlement de copropriété sans ses zéros de tête, puis numéro du lot
// précédé du nom court du bâtiment (accolé s'il tient en 2 caractères :
// « D03 » ; sinon « Parking 01 »), puis le type.
export function lotDisplayLabel(lot: Pick<Lot, "refLot" | "batiment" | "lot" | "typeLot">): string {
  const ref = lot.refLot ? `Réf. ${lot.refLot.replace(/^0+(?=\d)/, "")}` : ""
  const building = buildingShortName(lot.batiment)
  const number =
    building && lot.lot ? (building.length <= 2 ? `${building}${lot.lot}` : `${building} ${lot.lot}`) : lot.lot || building
  return [ref, number].filter(Boolean).join(" — ") + (lot.typeLot ? ` · ${lot.typeLot}` : "")
}

export type Lot = {
  id: string
  refLot: string
  batiment: string
  lot: string
  typeLot: string
  isLinkable: boolean
  // Rattaché en lecture seule ici : l'attribution propriétaire/locataire est
  // une fonctionnalité à part (cf. mémoire project-scope-vision), pas gérée
  // depuis cet écran. Sert uniquement à bloquer la suppression d'un lot déjà
  // attribué.
  idProprietaire: string[]
  idLocataire: string[]
  // Ordre d'affichage choisi manuellement (réorganisation click-and-déplace,
  // cf. LotsSection) - absent sur les lots créés avant l'ajout de ce champ,
  // triés après ceux qui en ont un (cf. subscribeToLots).
  order?: number
  // Lot parent auquel CE lot (l'enfant, isLinkable=true) est rattaché - ex:
  // une place de parking rattachée à un appartement. Écrire ce champ
  // déclenche sync_lot_tenants côté serveur (functions_python/main.py), qui
  // recopie idProprietaire (et idLocataire si groupedWithParent) du parent
  // vers l'enfant - pas un simple champ d'affichage, cf. lib/lots.ts:linkLot.
  parentLotId?: string | null
  // Si vrai, le locataire du parent est aussi recopié sur l'enfant (pas
  // seulement le propriétaire, toujours recopié dès que parentLotId est
  // défini) - toujours vrai quand le rattachement est fait depuis ce BO
  // (linkLot), pas de granularité exposée ici.
  groupedWithParent?: boolean
  // Tantième général du lot (loi de 1965) - simple entier, seule base de
  // pondération (plus de clés de charge). Toujours écrit, y compris à 0 -
  // miroir de Lot.tantiemes/toJsonForDb côté app mobile (connectkasa,
  // lib/models/pages_models/lot.dart).
  tantiemes: number
}
