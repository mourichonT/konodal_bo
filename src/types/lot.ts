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
}
