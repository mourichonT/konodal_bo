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

export type StructureResidence = {
  id: string
  name: string
  type: string
  etage: string[]
  hasUnderground: boolean
  // Ordre d'affichage choisi manuellement (réorganisation click-and-déplace,
  // cf. StructuresSection) - absent sur les structures créées avant l'ajout
  // de ce champ, triées après celles qui en ont un (cf. subscribeToStructures).
  order?: number
}
