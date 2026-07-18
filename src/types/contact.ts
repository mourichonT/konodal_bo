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

// Nom de fichier dans Storage gs://konodal-dev.firebasestorage.app/
// assets/icones_presta/ - même convention que _prestaIconFileName côté app
// mobile (konodal_app/lib/vues/pages_vues/event_page/event_form.dart), qui
// résout ces mêmes fichiers via getDownloadURL() pour illustrer un event
// "Prestation externe" créé depuis l'app. EventFormDialog fait la même
// résolution côté BO au moment de la soumission - un nom de fichier ne
// périme jamais, contrairement à une URL de téléchargement mise en cache
// ici.
export const CONTACT_SERVICE_ICON_FILENAMES: Record<(typeof CONTACT_SERVICES)[number], string> = {
  Nettoyage: "nettoyage.png",
  "Espaces verts": "espaces-verts.png",
  Électricité: "electricite.png",
  "Entretiens Ascenseur": "entretien-ascenseur.png",
  "Chauffage collectif": "chauffage-collectif.png",
  Plomberie: "plomberie.png",
  "Ventilation (VMC)": "ventilation-vmc.png",
  "Portes et portails": "portes-portails.png",
  Vidéosurveillance: "videosurveillance.png",
  "Sécurité incendie": "securite-incendie.png",
  "Gestion administrative": "gestion-administrative.png",
  "Toiture / étanchéité": "toiture-etancheite.png",
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
