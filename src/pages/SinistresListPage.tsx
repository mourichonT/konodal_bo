import { useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { toast } from "sonner"
import {
  Archive,
  ArchiveRestore,
  CheckCircle2,
  Clock3,
  Eye,
  ListChecks,
  Send,
  TriangleAlert,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FilterKpiCard } from "@/components/FilterKpiCard"
import { SinistreThumbnail } from "@/components/SinistreThumbnail"
import { SinistrePriorityIcon } from "@/components/SinistrePriorityIcon"
import { useSignalementCount } from "@/hooks/useSignalementCount"
import { updateSinistreArchived } from "@/lib/sinistres"
import { sinistrePriorityLabels, sinistreStatusLabels, type SinistreStatus } from "@/types/sinistre"
import type { SinistresOutletContext } from "@/pages/SinistresPage"
import type { SinistreWithResidence } from "@/hooks/useAllSinistres"

const statusBadgeClass: Record<SinistreStatus, string> = {
  "Non envoyé": "border-transparent bg-slate-100 text-slate-800",
  Transmis: "border-transparent bg-amber-100 text-amber-800",
  "En cours": "border-transparent bg-sky-100 text-sky-800",
  Terminé: "border-transparent bg-emerald-100 text-emerald-800",
}

function countByStatus(sinistres: SinistreWithResidence[], statut: SinistreStatus) {
  return sinistres.filter((s) => (s.statut || "Non envoyé") === statut).length
}

export default function SinistresListPage() {
  const { sinistres, loading, filters } = useOutletContext<SinistresOutletContext>()
  const { search, residenceFilter, dateFrom, dateTo, showNonDeclares, showArchived } = filters
  const normalizedSearch = search.trim().toLowerCase()
  const [statusFilter, setStatusFilter] = useState<SinistreStatus | null>(null)

  const fromDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null
  const toDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null

  const filteredSinistres = sinistres.filter((s) => {
    if (!showArchived && s.archived) return false
    if (!showNonDeclares && (s.statut || "Non envoyé") === "Non envoyé") return false
    if (statusFilter && (s.statut || "Non envoyé") !== statusFilter) return false
    if (residenceFilter !== "all" && s.residenceId !== residenceFilter) return false
    if (fromDate && (!s.creationDate || s.creationDate < fromDate)) return false
    if (toDate && (!s.creationDate || s.creationDate > toDate)) return false
    if (!normalizedSearch) return true
    return (
      s.title.toLowerCase().includes(normalizedSearch) ||
      s.description.toLowerCase().includes(normalizedSearch) ||
      s.id.slice(-6).toLowerCase().includes(normalizedSearch)
    )
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="mb-[25px] grid grid-cols-4 gap-4">
        <FilterKpiCard
          label="Total tickets"
          value={sinistres.length}
          icon={ListChecks}
          colorClass="bg-slate-100 text-slate-600"
          active={statusFilter === null}
          onClick={() => setStatusFilter(null)}
        />
        <FilterKpiCard
          label={sinistreStatusLabels.Transmis}
          value={countByStatus(sinistres, "Transmis")}
          icon={Send}
          colorClass="bg-amber-100 text-amber-600"
          active={statusFilter === "Transmis"}
          onClick={() => setStatusFilter((prev) => (prev === "Transmis" ? null : "Transmis"))}
        />
        <FilterKpiCard
          label={sinistreStatusLabels["En cours"]}
          value={countByStatus(sinistres, "En cours")}
          icon={Clock3}
          colorClass="bg-sky-100 text-sky-600"
          active={statusFilter === "En cours"}
          onClick={() => setStatusFilter((prev) => (prev === "En cours" ? null : "En cours"))}
        />
        <FilterKpiCard
          label={sinistreStatusLabels.Terminé}
          value={countByStatus(sinistres, "Terminé")}
          icon={CheckCircle2}
          colorClass="bg-emerald-100 text-emerald-600"
          active={statusFilter === "Terminé"}
          onClick={() => setStatusFilter((prev) => (prev === "Terminé" ? null : "Terminé"))}
        />
      </div>

      <div className="flex flex-col">
        <div className="overflow-hidden rounded-xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] ring-1 ring-foreground/10">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>N° ticket</TableHead>
                <TableHead>Photo</TableHead>
                <TableHead>Titre</TableHead>
                <TableHead>Résidence</TableHead>
                <TableHead>Déclaré le</TableHead>
                <TableHead>Signalements</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Priorité</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white">
              {filteredSinistres.map((sinistre) => (
                <SinistreRow key={`${sinistre.residenceId}-${sinistre.id}`} sinistre={sinistre} />
              ))}
              {!loading && filteredSinistres.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    Aucun sinistre pour l'instant.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

function SinistreRow({ sinistre }: { sinistre: SinistreWithResidence }) {
  const statut = (sinistre.statut || "Non envoyé") as SinistreStatus
  const signalementCount = useSignalementCount(sinistre.residenceId, sinistre.id)

  async function handleToggleArchived() {
    try {
      await updateSinistreArchived(sinistre.residenceId, sinistre.id, !sinistre.archived)
    } catch (err) {
      toast.error("Échec de l'archivage : " + (err as Error).message)
    }
  }

  return (
    <TableRow>
      <TableCell className="font-mono text-xs text-muted-foreground">
        #{sinistre.id.slice(-6).toUpperCase()}
      </TableCell>
      <TableCell>
        <SinistreThumbnail pathImage={sinistre.pathImage} className="size-10 rounded-md" />
      </TableCell>
      <TableCell className="font-medium">
        <div className="flex items-center gap-1.5">
          {sinistre.title || "Sans titre"}
          {sinistre.archived && (
            <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
              Archivé
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>{sinistre.residenceName}</TableCell>
      <TableCell className="text-muted-foreground">
        {sinistre.creationDate ? sinistre.creationDate.toLocaleDateString("fr-FR") : "—"}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <TriangleAlert className="size-3.5" />
          {signalementCount + 1}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={statusBadgeClass[statut] ?? statusBadgeClass["Non envoyé"]}>
          {sinistreStatusLabels[statut] ?? statut}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <SinistrePriorityIcon priority={sinistre.priority} className="size-4" />
          {sinistrePriorityLabels[sinistre.priority]}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          {(statut === "Terminé" || sinistre.archived) && (
            <Button variant="outline" size="sm" onClick={handleToggleArchived}>
              {sinistre.archived ? <ArchiveRestore /> : <Archive />}
              {sinistre.archived ? "Désarchiver" : "Archiver"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            render={
              <Link to={`/sinistres/${sinistre.residenceId}/${sinistre.id}`} state={{ from: "liste" }} />
            }
          >
            <Eye />
            Voir
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
