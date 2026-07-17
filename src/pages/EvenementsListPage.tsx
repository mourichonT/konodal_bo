import { Link, useOutletContext } from "react-router-dom"
import { Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { EvenementsOutletContext } from "@/pages/EvenementsPage"
import type { EventWithResidence } from "@/hooks/useAllEvents"

export default function EvenementsListPage() {
  const { events, loading, filters } = useOutletContext<EvenementsOutletContext>()
  const { search, residenceFilter, dateFrom, dateTo } = filters
  const normalizedSearch = search.trim().toLowerCase()

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

  return (
    <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
      <CardContent className="flex flex-col">
        <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Titre</TableHead>
                <TableHead>Résidence</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Heure</TableHead>
                <TableHead>Prestataire</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.map((event) => (
                <EventRow key={`${event.residenceId}-${event.id}`} event={event} />
              ))}
              {!loading && filteredEvents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Aucune prestation pour l'instant.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          {filteredEvents.length} prestation{filteredEvents.length > 1 ? "s" : ""} au total
        </p>
      </CardContent>
    </Card>
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
