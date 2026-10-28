import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { subscribeToCsBillingEvents, type CsBillingEvent } from "@/lib/csAvance"
import { resolveUsersByUids } from "@/lib/users"
import type { KonodalUser } from "@/types/user"

// Historique de la facturation (offres, remises, résiliations, statuts
// Stripe, rappels envoyés), du plus récent au plus ancien.
export function HistoryCard({ residenceId }: { residenceId: string }) {
  const [events, setEvents] = useState<CsBillingEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [authors, setAuthors] = useState<Record<string, KonodalUser>>({})

  useEffect(
    () =>
      subscribeToCsBillingEvents(
        residenceId,
        (list) => {
          setEvents(list)
          setError(null)
        },
        (err) => setError(err.message)
      ),
    [residenceId]
  )

  useEffect(() => {
    const uids = [...new Set((events ?? []).map((e) => e.by).filter((uid): uid is string => !!uid))]
    if (uids.length === 0) return
    let cancelled = false
    resolveUsersByUids(uids).then((users) => {
      if (!cancelled) setAuthors(Object.fromEntries(users.map((user) => [user.uid, user])))
    })
    return () => {
      cancelled = true
    }
  }, [events])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Historique</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">Historique indisponible : {error}</p>
        ) : events === null ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun événement pour l'instant.</p>
        ) : (
          <ol className="flex flex-col">
            {events.map((event) => {
              const author = event.by ? authors[event.by] : undefined
              return (
                <li
                  key={event.id}
                  className="flex flex-col gap-0.5 border-l-2 border-[oklch(90%_0.03_155)] pb-4 pl-4 last:pb-0"
                >
                  <span className="text-sm">{event.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {event.at
                      ? `${event.at.toLocaleDateString("fr-FR")} à ${event.at.toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`
                      : "—"}
                    {author ? ` · ${[author.name, author.surname].filter(Boolean).join(" ") || author.email}` : ""}
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
