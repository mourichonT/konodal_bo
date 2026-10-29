import { useEffect, useMemo, useState } from "react"
import { useAccountRole } from "@/hooks/useAccountRole"
import { useScopedResidences } from "@/hooks/useScopedResidenceIds"
import { subscribeToUnreadMailCount } from "@/lib/messages"

// Pastille « Messages » du menu : messages de résidents que l'agence n'a pas
// encore ouverts, toutes résidences de son périmètre. Compte agence et
// agents seulement (le superAdmin consulte sans traiter les messages).
export function useUnreadMessagesCount(): number {
  const { isAgence, isAgent } = useAccountRole()
  const { residences } = useScopedResidences()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const key = (isAgence || isAgent ? residences.map((r) => r.id) : []).sort().join(",")

  useEffect(() => {
    setCounts({})
    if (!key) return
    const unsubscribes = key.split(",").map((id) =>
      subscribeToUnreadMailCount(
        id,
        (count) => setCounts((prev) => ({ ...prev, [id]: count })),
        () => setCounts((prev) => ({ ...prev, [id]: 0 }))
      )
    )
    return () => unsubscribes.forEach((unsub) => unsub())
  }, [key])

  return useMemo(() => Object.values(counts).reduce((sum, n) => sum + n, 0), [counts])
}
