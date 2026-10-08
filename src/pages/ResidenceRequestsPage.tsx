import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { CheckCircle2, Clock, Eye, Inbox, Timer, XCircle } from "lucide-react"
import { FilterKpiCard } from "@/components/FilterKpiCard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  REQUEST_STATUS_BADGE_CLASS as STATUS_BADGE_CLASS,
  REQUEST_STATUS_LABEL as STATUS_LABEL,
  subscribeToResidenceRequests,
} from "@/lib/residenceRequests"
import type { ResidenceRequest, ResidenceRequestStatus } from "@/types/residenceRequest"

function formatDate(request: ResidenceRequest): string {
  return request.createdAt ? request.createdAt.toDate().toLocaleDateString("fr-FR") : "—"
}

// Délai moyen création -> traitement des demandes déjà traitées, en jours
// (une décimale) ; null tant qu'aucune n'a été traitée.
function averageProcessingDays(requests: ResidenceRequest[]): number | null {
  const delays = requests
    .filter((r) => r.status !== "pending" && r.createdAt && r.processedAt)
    .map((r) => (r.processedAt!.toMillis() - r.createdAt!.toMillis()) / 86_400_000)
  if (delays.length === 0) return null
  return Math.round((delays.reduce((sum, d) => sum + d, 0) / delays.length) * 10) / 10
}

export default function ResidenceRequestsPage() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState<ResidenceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<ResidenceRequestStatus | null>(null)

  useEffect(() => {
    return subscribeToResidenceRequests(
      (data) => {
        setRequests(data)
        setLoading(false)
      },
      (error) => {
        toast.error("Impossible de charger les demandes : " + error.message)
        setLoading(false)
      }
    )
  }, [])

  // Demandes en attente d'abord, puis l'historique (déjà trié par date).
  const sorted = [...requests]
    .filter((r) => statusFilter === null || r.status === statusFilter)
    .sort((a, b) => Number(a.status !== "pending") - Number(b.status !== "pending"))
  const countBy = (status: ResidenceRequestStatus) => requests.filter((r) => r.status === status).length
  const pendingCount = countBy("pending")
  const pendingLots = requests.filter((r) => r.status === "pending").reduce((sum, r) => sum + r.lots.length, 0)
  const avgDays = averageProcessingDays(requests)
  const toggleFilter = (status: ResidenceRequestStatus) =>
    setStatusFilter((prev) => (prev === status ? null : status))

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FilterKpiCard
          label={`En attente${pendingLots ? ` · ${pendingLots} lots` : ""}`}
          value={pendingCount}
          icon={Clock}
          colorClass="bg-amber-100 text-amber-600"
          active={statusFilter === "pending"}
          onClick={() => toggleFilter("pending")}
        />
        <FilterKpiCard
          label="Validées"
          value={countBy("approved")}
          icon={CheckCircle2}
          colorClass="bg-emerald-100 text-emerald-600"
          active={statusFilter === "approved"}
          onClick={() => toggleFilter("approved")}
        />
        <FilterKpiCard
          label="Refusées"
          value={countBy("rejected")}
          icon={XCircle}
          colorClass="bg-rose-100 text-rose-600"
          active={statusFilter === "rejected"}
          onClick={() => toggleFilter("rejected")}
        />
        <div className="flex items-center gap-6 rounded-[24px] border border-[oklch(93%_0.005_100)] bg-white p-4 shadow-[0_1px_2px_oklch(20%_0_0/0.03),0_14px_34px_-22px_oklch(20%_0_0/0.12)]">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <Timer className="size-5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-muted-foreground">Délai moyen de traitement</span>
            <span className="text-2xl font-semibold">
              {avgDays === null ? "—" : `${avgDays.toLocaleString("fr-FR")} j`}
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[24px] border border-[oklch(93%_0.005_100)] bg-white shadow-[0_1px_2px_oklch(20%_0_0/0.03),0_14px_34px_-22px_oklch(20%_0_0/0.12)]">
        <div className="px-7 pt-[26px] pb-5">
          <h2 className="mb-1 text-[17px] font-bold text-[oklch(22%_0.01_150)]">
            Inscriptions en offre gratuite {pendingCount > 0 && `· ${pendingCount} en attente`}
          </h2>
          <p className="text-[13.5px] text-muted-foreground">
            Envoyées depuis le formulaire konodal.com/inscription-residence. Valider crée la résidence, ses bâtiments
            et ses lots (sans tantièmes ni syndic).
          </p>
        </div>

        {!loading && sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-4 border-t border-[oklch(95%_0.003_100)] px-10 py-16">
            <div className="flex size-16 items-center justify-center rounded-[18px] bg-[oklch(93%_0.05_150)]">
              <Inbox className="size-7 text-[oklch(38%_0.09_155)]" />
            </div>
            <div className="text-center text-base font-bold text-[oklch(24%_0.01_150)]">
              {statusFilter ? `Aucune demande ${STATUS_LABEL[statusFilter].toLowerCase()}` : "Aucune demande pour l'instant"}
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Résidence</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead>Demandeur</TableHead>
                <TableHead>Lots</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white">
              {sorted.map((request) => (
                <TableRow
                  key={request.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/residences/demandes/${request.id}`)}
                >
                  <TableCell className="text-muted-foreground">{formatDate(request)}</TableCell>
                  <TableCell className="font-medium">{request.residence.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {request.residence.address.zipCode} {request.residence.address.city}
                  </TableCell>
                  <TableCell>
                    {request.requester.firstName} {request.requester.lastName}
                    <div className="text-xs text-muted-foreground">{request.requester.role}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{request.lots.length}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_BADGE_CLASS[request.status]}>
                      {STATUS_LABEL[request.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      {request.status === "approved" && request.residenceId && (
                        <Button variant="outline" size="sm" render={<Link to={`/residences/${request.residenceId}`} />}>
                          Résidence
                        </Button>
                      )}
                      <Button variant="outline" size="sm" render={<Link to={`/residences/demandes/${request.id}`} />}>
                        <Eye />
                        {request.status === "pending" ? "Examiner" : "Voir"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

    </div>
  )
}
