import { useEffect, useMemo, useState } from "react"
import { subscribeToResidences } from "@/lib/residences"
import { subscribeToContacts, residenceIdsForContact } from "@/lib/contacts"
import type { Residence } from "@/types/residence"
import type { Contact } from "@/types/contact"

// Contrairement à useAllSinistres/useAllEvents, "contacts" est une
// collection racine partagée (pas residences/{id}/contacts) : une seule
// souscription suffit, pas d'agrégation résidence par résidence. Le
// scoping RBAC (scopedResidenceIds, cf. useScopedResidenceIds) se fait donc
// après coup, sur les contacts déjà rattachés à au moins une résidence du
// périmètre - à la différence des autres onglets, la règle Firestore
// elle-même n'a pas de scoping résidence sur cette collection (annuaire
// partagé multi-agences), ce filtre est donc un confort d'affichage BO
// uniquement, pas une frontière de sécurité.
export function useAllContacts(onError: (message: string) => void, scopedResidenceIds?: Set<string> | null) {
  const [residences, setResidences] = useState<Residence[]>([])
  const [allContacts, setAllContacts] = useState<Contact[]>([])
  const [residencesLoaded, setResidencesLoaded] = useState(false)
  const [contactsLoaded, setContactsLoaded] = useState(false)

  useEffect(() => {
    return subscribeToResidences(
      (data) => {
        setResidences(data)
        setResidencesLoaded(true)
      },
      (error) => onError("Impossible de charger les résidences : " + error.message)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    if (!scopedResidenceIds) return allContacts
    return allContacts.filter((c) =>
      residenceIdsForContact(residences, c.id).some((id) => scopedResidenceIds.has(id))
    )
  }, [allContacts, residences, scopedResidenceIds])

  return { contacts, residences, loading: !residencesLoaded || !contactsLoaded }
}
