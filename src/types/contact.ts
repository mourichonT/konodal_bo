import type { Address } from "@/types/residence"

// Reflète TypeList.servicePrestaList côté app mobile
// (konodal_app/lib/models/enum/type_list.dart) - liste fermée choisie dans
// un dropdown, pas de saisie libre.
export const CONTACT_SERVICES = [
  "Nettoyage",
  "Espaces verts",
  "Électricité",
  "Entretiens Ascenseur",
  "Chauffage collectif",
  "Plomberie",
  "Ventilation (VMC)",
  "Portes et portails",
  "Vidéosurveillance",
  "Sécurité incendie",
  "Gestion administrative",
  "Toiture / étanchéité",
] as const

export type Contact = {
  id: string
  name: string
  service: string
  phone: string
  mail: string
  address: Address
  web: string
  // Résidences référençant ce contact (collection racine "contacts",
  // partagée - cf. konodal_app/lib/models/pages_models/contact.dart).
  residencesIds: string[]
  // Doublons probables détectés par nom normalisé entre résidences
  // différentes (migrate_contacts_to_root.py) - jamais fusionnés
  // automatiquement, à traiter manuellement ici.
  likelyDuplicateIds: string[]
  // Verrouillé côté règles Firestore : seul le BO (isSuperAdmin) peut le
  // faire passer à true, même logique que users/{uid}.isApproved.
  isApproved: boolean
}
