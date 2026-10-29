import { useEffect, useMemo, useState } from "react"
import { subscribeToResidenceMailbox, type ResidenceMail } from "@/lib/messages"
import type { Residence } from "@/types/residence"

// Mails de toutes les résidences du périmètre, en temps réel (une écoute par
// résidence : les règles Firestore sont par résidence). Une résidence
// illisible (droits) est simplement ignorée. Trié du plus récent au plus
// ancien.
export function useMailbox(residences: Residence[]) {
  const [byResidence, setByResidence] = useState<Record<string, ResidenceMail[]>>({})
  const [loaded, setLoaded] = useState<Set<string>>(new Set())
  const ids = useMemo(() => residences.map((r) => r.id).sort(), [residences])
  const key = ids.join(",")

  useEffect(() => {
    setByResidence({})
    setLoaded(new Set())
    const done = (id: string) => setLoaded((prev) => new Set(prev).add(id))
    const unsubscribes = ids.map((id) =>
      subscribeToResidenceMailbox(
        id,
        (mails) => {
          setByResidence((prev) => ({ ...prev, [id]: mails }))
          done(id)
        },
        (error) => {
          console.warn(`useMailbox: ${id} ignorée`, error)
          done(id)
        }
      )
    )
    return () => unsubscribes.forEach((unsub) => unsub())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const mails = useMemo(
    () =>
      Object.values(byResidence)
        .flat()
        .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0)),
    [byResidence]
  )
  return { mails, loading: loaded.size < ids.length }
}
