export type AddressSearchResult = {
  id: string
  label: string
  street: string
  zipCode: string
  city: string
}

type RawFeature = {
  properties: {
    id?: string
    banId?: string
    label?: string
    name?: string
    postcode?: string
    city?: string
  }
}

// API Adresse (Base Adresse Nationale, data.gouv.fr/IGN) - publique et
// gratuite, sans clé. `name` renvoie la voie AVEC numéro ("10 Rue de la
// Paix"), contrairement à `street` (juste "Rue de la Paix") - c'est bien
// `name` qu'on veut pour notre champ "Adresse".
export async function searchAddresses(query: string): Promise<AddressSearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []
  const response = await fetch(
    `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(trimmed)}&limit=5`
  )
  if (!response.ok) {
    throw new Error("Recherche d'adresse impossible pour le moment")
  }
  const data = (await response.json()) as { features?: RawFeature[] }
  return (data.features ?? []).map((f) => ({
    id: f.properties.id || f.properties.banId || f.properties.label || "",
    label: f.properties.label ?? "",
    street: f.properties.name ?? "",
    zipCode: f.properties.postcode ?? "",
    city: f.properties.city ?? "",
  }))
}

type RawCommune = { nom: string; code: string }

// API découpage administratif (geo.api.gouv.fr, IGN/Etalab) - publique et
// gratuite, sans clé. Un même code postal couvre souvent plusieurs communes
// (ex: 01090 → 6 communes) - l'appelant doit gérer 0, 1 ou plusieurs
// résultats plutôt que supposer une correspondance unique.
export async function searchCitiesByZipCode(zipCode: string): Promise<string[]> {
  const trimmed = zipCode.trim()
  if (!/^\d{5}$/.test(trimmed)) return []
  const response = await fetch(
    `https://geo.api.gouv.fr/communes?codePostal=${encodeURIComponent(trimmed)}&fields=nom&format=json`
  )
  if (!response.ok) {
    throw new Error("Recherche de ville impossible pour le moment")
  }
  const communes = (await response.json()) as RawCommune[]
  return communes.map((c) => c.nom)
}
