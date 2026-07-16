import type { Address } from "@/types/residence"

export type GeoPoint = { lat: number; lng: number }

// API Adresse (Base Adresse Nationale, data.gouv.fr/IGN) : service public de
// géocodage gratuit et sans clé, déjà utilisé côté app mobile (connectkasa)
// pour l'autocomplétion d'adresse - cf. ban_address_suggestion.dart.
const BAN_SEARCH_URL = "https://api-adresse.data.gouv.fr/search/"

export async function geocodeAddress(address: Address): Promise<GeoPoint | null> {
  const query = [address.street, address.zipCode, address.city].filter(Boolean).join(" ")
  if (!query.trim()) return null

  const url = `${BAN_SEARCH_URL}?q=${encodeURIComponent(query)}&limit=1`
  const response = await fetch(url)
  if (!response.ok) return null

  const data = await response.json()
  const feature = data.features?.[0]
  const coordinates = feature?.geometry?.coordinates
  if (!coordinates || coordinates.length < 2) return null

  // GeoJSON encode les coordonnées en [longitude, latitude], pas l'inverse.
  const [lng, lat] = coordinates
  return { lat, lng }
}
