import { useEffect, useMemo, useState } from "react"
import { useScopedResidences } from "@/hooks/useScopedResidenceIds"
import { subscribeToContacts, residenceIdsForContact } from "@/lib/contacts"
import type { Contact } from "@/types/contact"

// Contrairement à useAllSinistres/useAllEvents, "contacts" est une
// collection racine partagée (pas residences/{id}/contacts) : une seule
// souscription suffit, pas d'agrégation résidence par résidence. Le
// scoping RBAC (useScopedResidences) se fait donc
// après coup, sur les contacts déjà rattachés à au moins une résidence du
// périmètre - à la différence des autres onglets, la règle Firestore
// elle-même n'a pas de scoping résidence sur cette collection (annuaire
// partagé multi-agences), ce filtre est donc un confort d'affichage BO
// uniquement, pas une frontière de sécurité.
export function useAllContacts(onError: (message: string) => void) {
  const { residences, isUnrestricted, loading: residencesLoading } = useScopedResidences()
  const [allContacts, setAllContacts] = useState<Contact[]>([])
  const [contactsLoaded, setContactsLoaded] = useState(false)

  useEffect(() => {
    return subscribeToContacts(
      (data) => {
        setAllContacts(data)
        setContactsLoaded(true)
      },
      (error) => onError("Impossible de charger les contacts : " + error.message)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const contacts = useMemo(() => {
    if (isUnrestricted) return allContacts
    // residences ne contient que le périmètre : un contact rattaché à au
    // moins une de ces résidences est dans le périmètre.
    return allContacts.filter((c) => residenceIdsForContact(residences, c.id).length > 0)
  }, [allContacts, residences, isUnrestricted])

  return { contacts, residences, loading: residencesLoading || !contactsLoaded }
}
