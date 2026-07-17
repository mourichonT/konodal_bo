import { useEffect, useMemo, useState } from "react"
import { subscribeToResidences } from "@/lib/residences"
import { subscribeToResidenceEvents } from "@/lib/events"
import type { Residence } from "@/types/residence"
import type { ResidenceEvent } from "@/types/event"

export type EventWithResidence = ResidenceEvent & { residenceName: string }

// Agrège les events "prestation" de toutes les résidences, même choix que
// useAllSinistres (pas de collectionGroup disponible côté connectkasa) - on
// expose aussi `residences` (pas seulement les résidences ayant déjà des
// events) car le formulaire de création doit pouvoir cibler une résidence
// qui n'a encore aucun event.
export function useAllEvents(onError: (message: string) => void) {
  const [residences, setResidences] = useState<Residence[]>([])
  const [byResidence, setByResidence] = useState<Record<string, ResidenceEvent[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    return subscribeToResidences(
      (data) => {
        setResidences(data)
        setLoading(false)
      },
      (error) => onError("Impossible de charger les résidences : " + error.message)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const unsubscribes = residences.map((residence) =>
      subscribeToResidenceEvents(
        residence.id,
        (data) => setByResidence((prev) => ({ ...prev, [residence.id]: data })),
        (error) =>
          onError(`Impossible de charger les events de ${residence.name} : ${error.message}`)
      )
    )
    return () => unsubscribes.forEach((unsub) => unsub())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [residences])

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
