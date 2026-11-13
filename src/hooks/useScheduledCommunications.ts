import { useEffect, useMemo, useState } from "react"
import { useScopedResidences } from "@/hooks/useScopedResidenceIds"
import { subscribeToResidenceScheduledCommunications, type ScheduledCommunication } from "@/lib/communications"

export type ScheduledCommunicationWithResidence = ScheduledCommunication & { residenceName: string }

// Communications programmées des résidences du périmètre, même fan-out que
// useAllCommunications. Une résidence refusée par les règles (compte qui
// n'est pas son syndic) est ignorée sans message : la liste est secondaire.
export function useScheduledCommunications() {
  const [byResidence, setByResidence] = useState<Record<string, ScheduledCommunication[]>>({})
  const { residences } = useScopedResidences()

  useEffect(() => {
    const unsubscribes = residences.map((residence) =>
      subscribeToResidenceScheduledCommunications(
        residence.id,
        (data) => setByResidence((prev) => ({ ...prev, [residence.id]: data })),
        (error) => console.warn(`Communications programmées de ${residence.name} ignorées`, error)
      )
    )
    return () => unsubscribes.forEach((unsub) => unsub())
  }, [residences])

  return useMemo(() => {
    const names = new Map(residences.map((r) => [r.id, r.name]))
    return Object.values(byResidence)
      .flat()
      .filter((c) => names.has(c.residenceId))
      .map((c) => ({ ...c, residenceName: names.get(c.residenceId) ?? c.residenceId }))
  }, [byResidence, residences])
}
