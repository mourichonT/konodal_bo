import { useEffect, useState } from "react"
import { subscribeToResidences } from "@/lib/residences"
import { subscribeToContacts } from "@/lib/contacts"
import type { Residence } from "@/types/residence"
import type { Contact } from "@/types/contact"

// Contrairement à useAllSinistres/useAllEvents, "contacts" est une
// collection racine partagée (pas residences/{id}/contacts) : une seule
// souscription suffit, pas d'agrégation résidence par résidence.
export function useAllContacts(onError: (message: string) => void) {
  const [residences, setResidences] = useState<Residence[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
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
        setContacts(data)
        setContactsLoaded(true)
      },
      (error) => onError("Impossible de charger les contacts : " + error.message)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { contacts, residences, loading: !residencesLoaded || !contactsLoaded }
}
