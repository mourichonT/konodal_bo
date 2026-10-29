import { useEffect, useState } from "react"
import { NO_BILLING, subscribeToGeranceBilling } from "@/lib/billing"
import type { GeranceBilling } from "@/types/billing"

// Abonnement d'une agence en temps réel (gerances/{id}/billing/current) :
// licences, statut. Document absent = aucun abonnement.
export function useGeranceBilling(geranceId: string | undefined): GeranceBilling {
  const [billing, setBilling] = useState<GeranceBilling>(NO_BILLING)
  useEffect(() => {
    setBilling(NO_BILLING)
    if (!geranceId) return
    return subscribeToGeranceBilling(geranceId, setBilling, () => setBilling(NO_BILLING))
  }, [geranceId])
  return billing
}
