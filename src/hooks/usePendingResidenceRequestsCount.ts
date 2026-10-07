import { useEffect, useState } from "react"
import { subscribeToResidenceRequests } from "@/lib/residenceRequests"

// Pastille sidebar "Demandes de résidence" - superAdmin uniquement :
// residenceRequests n'est lisible que par lui (firestore.rules), la
// souscription n'est donc pas ouverte pour les autres comptes.
export function usePendingResidenceRequestsCount(enabled: boolean): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!enabled) {
      setCount(0)
      return
    }
    return subscribeToResidenceRequests(
      (requests) => setCount(requests.filter((r) => r.status === "pending").length),
      () => setCount(0)
    )
  }, [enabled])
  return count
}
