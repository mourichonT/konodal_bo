import { useEffect, useState } from "react"
import { subscribeToModerationReports } from "@/lib/moderation"

// Pastille « Modération » (menu Contenus, bascule d'en-tête) : contenus
// signalés à traiter. SuperAdmin uniquement, comme la page.
export function usePendingModerationCount(enabled: boolean): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!enabled) {
      setCount(0)
      return
    }
    return subscribeToModerationReports(
      (reports) => setCount(reports.filter((r) => r.status === "A_TRAITER").length),
      () => setCount(0)
    )
  }, [enabled])
  return count
}
