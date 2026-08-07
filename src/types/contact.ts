import type { Address } from "@/types/residence"
// ?url force une vraie URL même pour les fichiers < 4 Ko (que Vite
// inlinerait sinon en base64) - CONTACT_SERVICE_ICONS est réutilisé tel
// quel comme pathImage d'une intervention, envoyé jusque dans l'email
// (EvenementDetailPage), pas juste affiché dans un <img> de cette app.
import chauffageCollectif from "@/assets/icones_presta/chauffage-collectif.png?url&no-inline"
import electricite from "@/assets/icones_presta/electricite.png?url&no-inline"
import entretienAscenseur from "@/assets/icones_presta/entretien-ascenseur.png?url&no-inline"
import espacesVerts from "@/assets/icones_presta/espaces-verts.png?url&no-inline"
import gestionAdministrative from "@/assets/icones_presta/gestion-administrative.png?url&no-inline"
import nettoyage from "@/assets/icones_presta/nettoyage.png?url&no-inline"
import plomberie from "@/assets/icones_presta/plomberie.png?url&no-inline"
import portesPortails from "@/assets/icones_presta/portes-portails.png?url&no-inline"
import securiteIncendie from "@/assets/icones_presta/securite-incendie.png?url&no-inline"
import toitureEtancheite from "@/assets/icones_presta/toiture-etancheite.png?url&no-inline"
import ventilationVmc from "@/assets/icones_presta/ventilation-vmc.png?url&no-inline"
import videosurveillance from "@/assets/icones_presta/videosurveillance.png?url&no-inline"

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

// Icône du service, utilisée comme pathImage d'une intervention quand le
// prestataire choisi est un contact (EventFormDialog.resolvePrestaImage).
// Assets bundlés localement (src/assets/icones_presta/) - pas résolus via
// Firebase Storage (gs://.../assets/icones_presta/<fichier>.png) : ces
// fichiers n'y ont jamais été effectivement uploadés, ce qui faisait
// échouer getDownloadURL() en silence et laissait pathImage vide pour
// toute intervention programmée depuis ce backoffice. L'app mobile
// (konodal_app/lib/vues/pages_vues/event_page/event_form.dart) résout ces
// mêmes noms de fichiers via Storage pour son propre flux "Prestation
// externe" - toujours cassé côté app tant que ces fichiers n'y sont pas
// uploadés, hors périmètre de ce correctif BO.
export const CONTACT_SERVICE_ICONS: Record<(typeof CONTACT_SERVICES)[number], string> = {
  Nettoyage: nettoyage,
  "Espaces verts": espacesVerts,
  Électricité: electricite,
  "Entretiens Ascenseur": entretienAscenseur,
  "Chauffage collectif": chauffageCollectif,
  Plomberie: plomberie,
  "Ventilation (VMC)": ventilationVmc,
  "Portes et portails": portesPortails,
  Vidéosurveillance: videosurveillance,
  "Sécurité incendie": securiteIncendie,
  "Gestion administrative": gestionAdministrative,
  "Toiture / étanchéité": toitureEtancheite,
}

export type Contact = {
  id: string
  name: string
  service: string
  phone: string
  mail: string
  address: Address
  web: string
  // Obligatoire à la création/édition depuis ce backoffice (superAdmin,
  // agence, agent) - cf. ContactFormDialog/ContactDetailPage. Absent sur les
  // contacts créés avant l'ajout de ce champ, d'où le typage non-optionnel
  // mais une valeur par défaut vide côté toContact.
  siret: string
  // Doublons probables détectés par nom normalisé entre résidences
  // différentes (migrate_contacts_to_root.py) - jamais fusionnés
  // automatiquement, à traiter manuellement ici.
  likelyDuplicateIds: string[]
  // Verrouillé côté règles Firestore : seul le BO (isSuperAdmin) peut le
  // faire passer à true, même logique que users/{uid}.isApproved.
  isApproved: boolean
}
