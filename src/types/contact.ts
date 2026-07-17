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

// URL d'icône Storage par service, utilisée comme pathImage des interventions
// (events) créées depuis le BO quand le prestataire choisi est un contact
// (plutôt que la gérance, cf. GERANCE_PLACEHOLDER_LOGO_URL dans lib/events.ts).
// Vide tant que les assets ne sont pas uploadés - à compléter une fois les
// 12 icônes disponibles dans Storage (ex: assets/services/{slug}.png).
export const CONTACT_SERVICE_ICON_URLS: Record<(typeof CONTACT_SERVICES)[number], string> = {
  Nettoyage: "",
  "Espaces verts": "",
  Électricité: "",
  "Entretiens Ascenseur": "",
  "Chauffage collectif": "",
  Plomberie: "",
  "Ventilation (VMC)": "",
  "Portes et portails": "",
  Vidéosurveillance: "",
  "Sécurité incendie": "",
  "Gestion administrative": "",
  "Toiture / étanchéité": "",
}

export type Contact = {
  id: string
  name: string
  service: string
  phone: string
  mail: string
  address: Address
  web: string
  // Doublons probables détectés par nom normalisé entre résidences
  // différentes (migrate_contacts_to_root.py) - jamais fusionnés
  // automatiquement, à traiter manuellement ici.
  likelyDuplicateIds: string[]
  // Verrouillé côté règles Firestore : seul le BO (isSuperAdmin) peut le
  // faire passer à true, même logique que users/{uid}.isApproved.
  isApproved: boolean
}
