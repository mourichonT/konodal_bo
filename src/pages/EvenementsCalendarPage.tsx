import { useMemo, useState } from "react"
import { useNavigate, useOutletContext } from "react-router-dom"
import { Building2, CalendarCheck, CalendarClock, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { EvenementsOutletContext } from "@/pages/EvenementsPage"
import type { EventWithResidence } from "@/hooks/useAllEvents"

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

// Grille mensuelle en JS natif (pas de date-fns/dayjs dans le projet) - les
// semaines démarrent le lundi, convention française.
function buildMonthGrid(monthStart: Date): Date[] {
  const year = monthStart.getFullYear()
  const month = monthStart.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7 // 0 = lundi
  const gridStart = new Date(year, month, 1 - firstWeekday)
  return Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i))
}

export default function EvenementsCalendarPage() {
  const { events, filters } = useOutletContext<EvenementsOutletContext>()
  const { search, residenceFilter, dateFrom, dateTo } = filters
  const normalizedSearch = search.trim().toLowerCase()
  const navigate = useNavigate()
  const [monthStart, setMonthStart] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  // Déclenché par les KPI "Prévues aujourd'hui"/"Interventions programmées" -
  // remplace la grille mensuelle par une vue jour (today) ou agenda groupée
  // par jour (scheduled) ; un seul mode actif à la fois, re-cliquer sur le
  // même KPI revient à la grille du mois.
  const [viewMode, setViewMode] = useState<"month" | "today" | "scheduled" | "residencesToday">("month")

  const fromDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null
  const toDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null

  const filteredEvents = events.filter((e) => {
    if (residenceFilter !== "all" && e.residenceId !== residenceFilter) return false
    if (fromDate && (!e.eventDate || e.eventDate < fromDate)) return false
    if (toDate && (!e.eventDate || e.eventDate > toDate)) return false
    if (!normalizedSearch) return true
    return (
      e.title.toLowerCase().includes(normalizedSearch) ||
      e.description.toLowerCase().includes(normalizedSearch) ||
      e.prestaName.toLowerCase().includes(normalizedSearch)
    )
  })

  const today = new Date()

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventWithResidence[]>()
    for (const event of filteredEvents) {
      if (!event.eventDate) continue
      const key = dayKey(event.eventDate)
      const list = map.get(key) ?? []
      list.push(event)
      map.set(key, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.eventDate?.getTime() ?? 0) - (b.eventDate?.getTime() ?? 0))
    }
    return map
  }, [filteredEvents])

  const grid = useMemo(() => buildMonthGrid(monthStart), [monthStart])
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  // "Aujourd'hui" : jour calendaire courant, indépendamment du mois affiché
  // dans la grille. "Programmées" : aujourd'hui + à venir - un sur-ensemble
  // du premier compteur, cohérent avec "programmé" = pas encore passé.
  const todayEvents = filteredEvents.filter((e) => e.eventDate && dayKey(e.eventDate) === dayKey(today))
  const scheduledEvents = filteredEvents.filter((e) => e.eventDate && e.eventDate >= startOfToday)
  const todayCount = todayEvents.length
  const scheduledCount = scheduledEvents.length
  // Nombre de résidences distinctes concernées - une résidence avec 3
  // interventions le même jour ne doit compter que pour 1 ici, contrairement
  // aux compteurs d'interventions ci-dessus.
  const residencesTodayCount = new Set(todayEvents.map((e) => e.residenceId)).size
  const residencesScheduledCount = new Set(scheduledEvents.map((e) => e.residenceId)).size

  // Agenda "programmées" : groupé par jour, jours triés chronologiquement -
  // dayKey() n'est pas trié lexicographiquement (mois/jour non paddés), on
  // garde donc une Date représentative par groupe pour le tri.
  const scheduledByDay = useMemo(() => {
    const map = new Map<string, { date: Date; events: EventWithResidence[] }>()
    for (const event of scheduledEvents) {
      if (!event.eventDate) continue
      const key = dayKey(event.eventDate)
      const entry = map.get(key) ?? {
        date: new Date(event.eventDate.getFullYear(), event.eventDate.getMonth(), event.eventDate.getDate()),
        events: [],
      }
      entry.events.push(event)
      map.set(key, entry)
    }
    for (const entry of map.values()) {
      entry.events.sort((a, b) => (a.eventDate?.getTime() ?? 0) - (b.eventDate?.getTime() ?? 0))
    }
    return [...map.values()].sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [scheduledEvents])

  // Inverse du groupement par jour : "Résidences concernées aujourd'hui" met
  // la résidence en avant plutôt que la date (déjà fixée à aujourd'hui, donc
  // sans intérêt à répéter par ligne ici).
  const todayByResidence = useMemo(() => {
    const map = new Map<string, { residenceName: string; events: EventWithResidence[] }>()
    for (const event of todayEvents) {
      const entry = map.get(event.residenceId) ?? { residenceName: event.residenceName, events: [] }
      entry.events.push(event)
      map.set(event.residenceId, entry)
    }
    for (const entry of map.values()) {
      entry.events.sort((a, b) => (a.eventDate?.getTime() ?? 0) - (b.eventDate?.getTime() ?? 0))
    }
    return [...map.values()].sort((a, b) => a.residenceName.localeCompare(b.residenceName))
  }, [todayEvents])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-[30px]">
        <div className="grid flex-1 grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setViewMode((prev) => (prev === "today" ? "month" : "today"))}
            className={cn(
              "flex items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-shadow",
              viewMode === "today" ? "ring-2 ring-primary" : "hover:shadow-[0_8px_30px_rgb(0,0,0,0.1)]"
            )}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600">
              <CalendarCheck className="size-5" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-muted-foreground">Prévues aujourd'hui</span>
              <span className="text-2xl font-semibold">{todayCount}</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setViewMode((prev) => (prev === "scheduled" ? "month" : "scheduled"))}
            className={cn(
              "flex items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-shadow",
              viewMode === "scheduled" ? "ring-2 ring-primary" : "hover:shadow-[0_8px_30px_rgb(0,0,0,0.1)]"
            )}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CalendarClock className="size-5" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-muted-foreground">Interventions programmées</span>
              <span className="text-2xl font-semibold">{scheduledCount}</span>
            </div>
          </button>
        </div>

        <div aria-hidden className="hidden w-px shrink-0 self-stretch bg-border lg:block" />

        <div className="grid flex-1 grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setViewMode((prev) => (prev === "residencesToday" ? "month" : "residencesToday"))}
            className={cn(
              "flex items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-shadow",
              viewMode === "residencesToday" ? "ring-2 ring-primary" : "hover:shadow-[0_8px_30px_rgb(0,0,0,0.1)]"
            )}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600">
              <Building2 className="size-5" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-muted-foreground">Résidences concernées aujourd'hui</span>
              <span className="text-2xl font-semibold">{residencesTodayCount}</span>
            </div>
          </button>
          <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
            <CardContent className="flex items-center gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Building2 className="size-5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm text-muted-foreground">Résidences avec interventions à venir</span>
                <span className="text-2xl font-semibold">{residencesScheduledCount}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {viewMode === "residencesToday" ? (
        <div className="flex flex-col gap-4">
          {todayByResidence.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Aucune résidence concernée aujourd'hui.
            </p>
          )}
          {todayByResidence.map(({ residenceName, events: residenceEvents }) => (
            <Card
              key={residenceEvents[0]?.residenceId ?? residenceName}
              className="overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]"
            >
              <CardHeader>
                <CardTitle className="text-xl">{residenceName}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col divide-y p-0">
                {residenceEvents.map((event) => (
                  <button
                    key={`${event.residenceId}-${event.id}`}
                    type="button"
                    onClick={() =>
                      navigate(`/evenements/${event.residenceId}/${event.id}`, {
                        state: { from: "calendrier" },
                      })
                    }
                    className="flex items-center justify-between gap-3 px-6 py-3 text-left hover:bg-muted/50"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{event.title || "Sans titre"}</span>
                      {event.prestaName && (
                        <span className="text-sm text-muted-foreground">{event.prestaName}</span>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {event.eventDate?.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </button>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : viewMode === "scheduled" ? (
        <div className="flex flex-col gap-4">
          {scheduledByDay.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Aucune intervention programmée.
            </p>
          )}
          {scheduledByDay.map(({ date, events: dayEvents }) => (
            <Card key={date.toISOString()} className="overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
              <CardHeader>
                <CardTitle className="text-xl capitalize">
                  {date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col divide-y p-0">
                {dayEvents.map((event) => (
                  <button
                    key={`${event.residenceId}-${event.id}`}
                    type="button"
                    onClick={() =>
                      navigate(`/evenements/${event.residenceId}/${event.id}`, {
                        state: { from: "calendrier" },
                      })
                    }
                    className="flex items-center justify-between gap-3 px-6 py-3 text-left hover:bg-muted/50"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{event.title || "Sans titre"}</span>
                      <span className="text-sm text-muted-foreground">
                        {event.residenceName}
                        {event.prestaName ? ` · ${event.prestaName}` : ""}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {event.eventDate?.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </button>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : viewMode === "today" ? (
        <div className="overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
          <div className="border-b bg-muted/40 px-4 py-3">
            <h2 className="text-lg font-semibold capitalize">
              {today.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </h2>
          </div>
          <div className="flex flex-col divide-y">
            {todayEvents.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Aucune intervention prévue aujourd'hui.
              </p>
            )}
            {todayEvents.map((event) => (
              <button
                key={`${event.residenceId}-${event.id}`}
                type="button"
                onClick={() =>
                  navigate(`/evenements/${event.residenceId}/${event.id}`, {
                    state: { from: "calendrier" },
                  })
                }
                className="flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{event.title || "Sans titre"}</span>
                  <span className="text-sm text-muted-foreground">
                    {event.residenceName}
                    {event.prestaName ? ` · ${event.prestaName}` : ""}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {event.eventDate?.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold capitalize">
              {monthStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1))}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMonthStart(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
              >
                Aujourd'hui
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
            <div className="grid grid-cols-7 border-b bg-muted/40">
              {WEEKDAYS.map((day) => (
                <div key={day} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {grid.map((date) => {
                const inMonth = date.getMonth() === monthStart.getMonth()
                const isToday = dayKey(date) === dayKey(today)
                const dayEvents = eventsByDay.get(dayKey(date)) ?? []
                return (
                  <div
                    key={date.toISOString()}
                    className={cn(
                      "flex min-h-24 flex-col gap-1 border-r border-b p-1.5 last:border-r-0",
                      !inMonth && "bg-muted/20"
                    )}
                  >
                    <span
                      className={cn(
                        "w-fit rounded-full px-1.5 text-xs",
                        !inMonth && "text-muted-foreground/50",
                        isToday && "bg-primary text-primary-foreground"
                      )}
                    >
                      {date.getDate()}
                    </span>
                    <div className="flex flex-col gap-1">
                      {dayEvents.map((event) => (
                        <button
                          key={`${event.residenceId}-${event.id}`}
                          type="button"
                          onClick={() =>
                            navigate(`/evenements/${event.residenceId}/${event.id}`, {
                              state: { from: "calendrier" },
                            })
                          }
                          className="truncate rounded bg-accent px-1.5 py-0.5 text-left text-xs text-accent-foreground hover:opacity-80"
                          title={event.title}
                        >
                          {event.eventDate?.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}{" "}
                          {event.title || "Sans titre"}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
