// Regroupement des résidences par département (dérivé du code postal) pour
// le ciblage des campagnes publicitaires - pas de champ "zone géographique"
// dédié dans le modèle Residence, le département est un proxy suffisant et
// ne nécessite aucune donnée supplémentaire à saisir/maintenir.
const DEPARTMENT_NAMES: Record<string, string> = {
  "01": "Ain", "02": "Aisne", "03": "Allier", "04": "Alpes-de-Haute-Provence",
  "05": "Hautes-Alpes", "06": "Alpes-Maritimes", "07": "Ardèche", "08": "Ardennes",
  "09": "Ariège", "10": "Aube", "11": "Aude", "12": "Aveyron",
  "13": "Bouches-du-Rhône", "14": "Calvados", "15": "Cantal", "16": "Charente",
  "17": "Charente-Maritime", "18": "Cher", "19": "Corrèze",
  "2A": "Corse-du-Sud", "2B": "Haute-Corse",
  "21": "Côte-d'Or", "22": "Côtes-d'Armor", "23": "Creuse", "24": "Dordogne",
  "25": "Doubs", "26": "Drôme", "27": "Eure", "28": "Eure-et-Loir",
  "29": "Finistère", "30": "Gard", "31": "Haute-Garonne", "32": "Gers",
  "33": "Gironde", "34": "Hérault", "35": "Ille-et-Vilaine", "36": "Indre",
  "37": "Indre-et-Loire", "38": "Isère", "39": "Jura", "40": "Landes",
  "41": "Loir-et-Cher", "42": "Loire", "43": "Haute-Loire", "44": "Loire-Atlantique",
  "45": "Loiret", "46": "Lot", "47": "Lot-et-Garonne", "48": "Lozère",
  "49": "Maine-et-Loire", "50": "Manche", "51": "Marne", "52": "Haute-Marne",
  "53": "Mayenne", "54": "Meurthe-et-Moselle", "55": "Meuse", "56": "Morbihan",
  "57": "Moselle", "58": "Nièvre", "59": "Nord", "60": "Oise", "61": "Orne",
  "62": "Pas-de-Calais", "63": "Puy-de-Dôme", "64": "Pyrénées-Atlantiques",
  "65": "Hautes-Pyrénées", "66": "Pyrénées-Orientales", "67": "Bas-Rhin",
  "68": "Haut-Rhin", "69": "Rhône", "70": "Haute-Saône", "71": "Saône-et-Loire",
  "72": "Sarthe", "73": "Savoie", "74": "Haute-Savoie", "75": "Paris",
  "76": "Seine-Maritime", "77": "Seine-et-Marne", "78": "Yvelines",
  "79": "Deux-Sèvres", "80": "Somme", "81": "Tarn", "82": "Tarn-et-Garonne",
  "83": "Var", "84": "Vaucluse", "85": "Vendée", "86": "Vienne",
  "87": "Haute-Vienne", "88": "Vosges", "89": "Yonne", "90": "Territoire de Belfort",
  "91": "Essonne", "92": "Hauts-de-Seine", "93": "Seine-Saint-Denis",
  "94": "Val-de-Marne", "95": "Val-d'Oise",
  "971": "Guadeloupe", "972": "Martinique", "973": "Guyane",
  "974": "La Réunion", "975": "Saint-Pierre-et-Miquelon", "976": "Mayotte",
}

export function departmentCodeFromZip(zipCode: string): string {
  const zip = zipCode.trim()
  if (zip.startsWith("97") || zip.startsWith("98")) return zip.slice(0, 3)
  if (zip.startsWith("20")) {
    const num = Number(zip)
    return num >= 20200 ? "2B" : "2A"
  }
  return zip.slice(0, 2)
}

export function departmentLabel(code: string): string {
  const name = DEPARTMENT_NAMES[code]
  return name ? `${code} - ${name}` : code || "Sans code postal"
}

// Groupé par département plutôt qu'une liste à plat de résidences - au-delà
// de quelques dizaines de résidences, sélectionner une par une pour cibler
// une campagne devient ingérable. Partagé entre AdCampaignFormDialog (création)
// et AdCampaignDetailPage (édition).
export function groupResidencesByDepartment<T extends { address: { zipCode: string } }>(
  residences: T[]
): [string, T[]][] {
  const groups = new Map<string, T[]>()
  for (const residence of residences) {
    const code = departmentCodeFromZip(residence.address.zipCode)
    groups.set(code, [...(groups.get(code) ?? []), residence])
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
}
