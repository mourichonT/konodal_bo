import { useEffect, useState } from "react"
import { subscribeToRemovalRequests } from "@/lib/residentRemovals"

// Pastille "Demandes de retrait" (sidebar, bascule de la page Utilisateurs) -
// superAdmin uniquement : la page et les décisions lui sont réservées, la
// souscription n'est pas ouverte pour les autres comptes.
export function usePendingRemovalRequestsCount(enabled: boolean): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!enabled) {
      setCount(0)
      return
    }
    return subscribeToRemovalRequests(
      (requests) => setCount(requests.filter((r) => r.status === "pending").length),
      () => setCount(0)
    )
  }, [enabled])
  return count
}
