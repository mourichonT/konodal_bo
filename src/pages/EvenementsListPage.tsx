import { useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { CheckCircle2, Clock3, Eye, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FilterKpiCard } from "@/components/FilterKpiCard"
import type { EvenementsOutletContext } from "@/pages/EvenementsPage"
import type { EventWithResidence } from "@/hooks/useAllEvents"

type TermineFilter = "termine" | "encours" | null

export default function EvenementsListPage() {
  const { events, loading, filters } = useOutletContext<EvenementsOutletContext>()
  const { search, residenceFilter, dateFrom, dateTo } = filters
  const normalizedSearch = search.trim().toLowerCase()
  const [termineFilter, setTermineFilter] = useState<TermineFilter>(null)

  const fromDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null
  const toDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null

  const filteredEvents = events.filter((e) => {
    if (termineFilter === "termine" && !e.termine) return false
    if (termineFilter === "encours" && e.termine) return false
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

  const encoursCount = events.filter((e) => !e.termine).length
  const termineCount = events.filter((e) => e.termine).length

  return (
    <div className="flex flex-col gap-4">
      <div className="mb-[25px] grid grid-cols-3 gap-4">
        <FilterKpiCard
          label="Total interventions"
          value={events.length}
          icon={ListChecks}
          colorClass="bg-slate-100 text-slate-600"
          active={termineFilter === null}
          onClick={() => setTermineFilter(null)}
        />
        <FilterKpiCard
          label="En cours"
          value={encoursCount}
          icon={Clock3}
          colorClass="bg-sky-100 text-sky-600"
          active={termineFilter === "encours"}
          onClick={() => setTermineFilter((prev) => (prev === "encours" ? null : "encours"))}
        />
        <FilterKpiCard
          label="Terminées"
          value={termineCount}
          icon={CheckCircle2}
          colorClass="bg-emerald-100 text-emerald-600"
          active={termineFilter === "termine"}
          onClick={() => setTermineFilter((prev) => (prev === "termine" ? null : "termine"))}
        />
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] ring-1 ring-foreground/10">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Titre</TableHead>
              <TableHead>Résidence</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Heure</TableHead>
              <TableHead>Prestataire</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white">
            {filteredEvents.map((event) => (
              <EventRow key={`${event.residenceId}-${event.id}`} event={event} />
            ))}
            {!loading && filteredEvents.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Aucune intervention pour l'instant.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function EventRow({ event }: { event: EventWithResidence }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{event.title || "Sans titre"}</TableCell>
      <TableCell>{event.residenceName}</TableCell>
      <TableCell className="text-muted-foreground">
        {event.eventDate ? event.eventDate.toLocaleDateString("fr-FR") : "—"}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {event.eventDate
          ? event.eventDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
          : "—"}
      </TableCell>
      <TableCell>{event.prestaName || "—"}</TableCell>
      <TableCell className="max-w-xs truncate text-muted-foreground">
        {event.description || "—"}
      </TableCell>
      <TableCell>
        {event.annule ? (
          <Badge variant="outline" className="border-transparent bg-red-100 text-red-800">
            Annulé
          </Badge>
        ) : event.reporte ? (
          <Badge variant="outline" className="border-transparent bg-amber-100 text-amber-800">
            Reporté
          </Badge>
        ) : event.termine ? (
          <Badge variant="outline" className="border-transparent bg-emerald-100 text-emerald-800">
            Terminé
          </Badge>
        ) : (
          <Badge variant="outline" className="border-transparent bg-sky-100 text-sky-800">
            Programmé
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="outline"
          size="sm"
          render={<Link to={`/evenements/${event.residenceId}/${event.id}`} state={{ from: "liste" }} />}
        >
          <Eye />
          Voir
        </Button>
      </TableCell>
    </TableRow>
  )
}
