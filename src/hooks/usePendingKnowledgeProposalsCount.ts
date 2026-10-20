import { useEffect, useState } from "react"
import { subscribeToKnowledgeProposals } from "@/lib/nodoKnowledge"

// Pastille "Propositions" (sidebar, sous-menu Base Nodo) : fiches proposées par
// la relecture hebdomadaire du journal de Nodo, en attente de validation -
// superAdmin uniquement (règles nodoKnowledgeProposals).
export function usePendingKnowledgeProposalsCount(enabled: boolean): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!enabled) {
      setCount(0)
      return
    }
    return subscribeToKnowledgeProposals(
      (proposals) => setCount(proposals.length),
      () => setCount(0)
    )
  }, [enabled])
  return count
}
