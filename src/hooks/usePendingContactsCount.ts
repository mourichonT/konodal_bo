import { useScopedResidenceIds } from "@/hooks/useScopedResidenceIds"
import { useAllContacts } from "@/hooks/useAllContacts"

// Même principe que usePendingUsersCount (pastille sidebar "Utilisateurs"),
// pour les contacts prestataires pas encore approuvés (Contact.isApproved) -
// même périmètre RBAC que ContactsPage.tsx (annuaire déjà scopé par
// useAllContacts). Pas de suivi "vu/non vu" : reflète simplement le nombre
// de contacts en attente à l'instant T.
export function usePendingContactsCount(): number {
  const { scopedResidenceIds } = useScopedResidenceIds()
  const { contacts } = useAllContacts(() => {}, scopedResidenceIds)
  return contacts.filter((c) => !c.isApproved).length
}
