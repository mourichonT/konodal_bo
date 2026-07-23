export const structureTypeOptions = [
  "Bâtiment",
  "Villa",
  "Lot",
  "Souterrain",
  "Jardin",
  "Local",
  "Annexe",
  "Parking",
  "Garage",
  "Cave",
  "Partie commune",
  "Exterieur",
]

// Reflète ElementsList.elements() côté app mobile (connectkasa,
// models/enum/elements_list.dart) - liste de suggestions, pas un enum
// fermé : l'app permet d'en ajouter des personnalisés en plus (chip
// "+ Ajouter"), cf. même liberté laissée ici (StructureCard).
export const structureElementOptions = [
  "Cage escalier",
  "Porte entrée",
  "Boîte aux lettres",
  "Porte Hall",
  "Porte",
  "Miroir",
  "Canalisation",
  "Caméra",
  "Lumières",
  "Portail",
  "Poubelle",
  "Arbres",
]

export type StructureResidence = {
  id: string
  name: string
  type: string
  etage: string[]
  hasUnderground: boolean
  // Éléments présents dans/autour du bâtiment (cage d'escalier, boîte aux
  // lettres...) - suggestions dans structureElementOptions, plus des
  // valeurs libres ajoutées à la main (mêmes deux sources que côté app).
  elements?: string[] | null
  // Ordre d'affichage choisi manuellement (réorganisation click-and-déplace,
  // cf. StructuresSection) - absent sur les structures créées avant l'ajout
  // de ce champ, triées après celles qui en ont un (cf. subscribeToStructures).
  order?: number
}
