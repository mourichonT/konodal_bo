import { useEffect, useMemo, useState } from "react"
import { useScopedResidences } from "@/hooks/useScopedResidenceIds"
import { subscribeToResidenceEvents } from "@/lib/events"
import type { ResidenceEvent } from "@/types/event"

export type EventWithResidence = ResidenceEvent & { residenceName: string }

// Agrège les events "intervention" de toutes les résidences, même choix que
// useAllSinistres (pas de collectionGroup disponible côté connectkasa) - on
// expose aussi `residences` (pas seulement les résidences ayant déjà des
// events) car le formulaire de création doit pouvoir cibler une résidence
// qui n'a encore aucun event.
// Périmètre RBAC : résidences de useScopedResidences (portefeuille de la
// gérance pour un compte agence/agent, jamais lues au-delà).
export function useAllEvents(onError: (message: string) => void) {
  const [byResidence, setByResidence] = useState<Record<string, ResidenceEvent[]>>({})
  const { residences, loading } = useScopedResidences()
  const scopedResidences = residences

  useEffect(() => {
    const unsubscribes = scopedResidences.map((residence) =>
      subscribeToResidenceEvents(
        residence.id,
        (data) => setByResidence((prev) => ({ ...prev, [residence.id]: data })),
        (error) =>
          onError(`Impossible de charger les events de ${residence.name} : ${error.message}`)
      )
    )
    return () => unsubscribes.forEach((unsub) => unsub())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedResidences])

  const residenceNameById = useMemo(
    () => new Map(residences.map((r) => [r.id, r.name])),
    [residences]
  )

  const events: EventWithResidence[] = useMemo(() => {
    return Object.values(byResidence)
      .flat()
      .map((e) => ({ ...e, residenceName: residenceNameById.get(e.residenceId) ?? e.residenceId }))
      .sort((a, b) => (a.eventDate?.getTime() ?? 0) - (b.eventDate?.getTime() ?? 0))
  }, [byResidence, residenceNameById])

  return { events, residences, loading }
}
