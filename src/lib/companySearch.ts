import { emptyAddress, type Address } from "@/types/residence"

export type CompanySearchResult = {
  siren: string
  siret: string
  name: string
  address: Address
  responsableLegal: string
}

// Champs bruts utiles de la réponse recherche-entreprises.api.gouv.fr - le
// reste (finances, complements, activité...) n'est pas utilisé ici.
type RawDirigeant = {
  nom?: string
  prenoms?: string
  denomination?: string
  qualite?: string
  type_dirigeant?: "personne physique" | "personne morale"
}

type RawResult = {
  siren: string
  nom_complet?: string
  nom_raison_sociale?: string
  dirigeants?: RawDirigeant[]
  siege?: {
    siret?: string
    numero_voie?: string
    type_voie?: string
    libelle_voie?: string
    code_postal?: string
    libelle_commune?: string
  }
}

function toResponsableLegal(dirigeants: RawDirigeant[] | undefined): string {
  // Le premier dirigeant "personne physique" (Gérant/Président/Directeur
  // général...) sert de responsable légal par défaut - une personne morale
  // (holding actionnaire) n'a pas sa place ici, et reste modifiable à la
  // main si le résultat automatique ne convient pas.
  const person = dirigeants?.find((d) => d.type_dirigeant === "personne physique")
  if (!person) return ""
  return [person.prenoms, person.nom].filter(Boolean).join(" ").trim()
}

function toCompanySearchResult(raw: RawResult): CompanySearchResult {
  const siege = raw.siege ?? {}
  return {
    siren: raw.siren ?? "",
    siret: siege.siret ?? "",
    name: raw.nom_raison_sociale || raw.nom_complet || "",
    address: {
      ...emptyAddress,
      street: [siege.numero_voie, siege.type_voie, siege.libelle_voie].filter(Boolean).join(" "),
      zipCode: siege.code_postal ?? "",
      city: siege.libelle_commune ?? "",
    },
    responsableLegal: toResponsableLegal(raw.dirigeants),
  }
}

// API publique officielle (data.gouv.fr/INPI), gratuite et sans clé -
// accepte aussi bien un SIRET/SIREN qu'une raison sociale dans `q`.
export async function searchCompanies(query: string): Promise<CompanySearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []
  const response = await fetch(
    `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(trimmed)}&per_page=5`
  )
  if (!response.ok) {
    throw new Error("Recherche impossible pour le moment")
  }
  const data = (await response.json()) as { results?: RawResult[] }
  return (data.results ?? []).map(toCompanySearchResult)
}
