import { useEffect, useState } from "react"
import { subscribeToAccountPairs } from "@/lib/accountUnifier"

// Pastille « Unificateur » (menu Utilisateurs, bascule d'en-tête) : paires
// de comptes en doublon à valider. SuperAdmin uniquement, comme la page.
export function usePendingAccountPairsCount(enabled: boolean): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!enabled) {
      setCount(0)
      return
    }
    return subscribeToAccountPairs(
      (pairs) => setCount(pairs.filter((p) => p.status === "A_VALIDER").length),
      () => setCount(0)
    )
  }, [enabled])
  return count
}
