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
}
