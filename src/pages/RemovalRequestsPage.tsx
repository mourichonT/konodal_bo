import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Ban, Clock, Eye, Inbox, XCircle } from "lucide-react"
import { FilterKpiCard } from "@/components/FilterKpiCard"
import { DocumentThumbnail } from "@/components/DocumentThumbnail"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { resolveUsersByUids } from "@/lib/users"
import {
  REMOVAL_REASON_LABEL,
  REMOVAL_STATUS_BADGE_CLASS,
  REMOVAL_STATUS_LABEL,
  decideRemovalRequest,
  residenceNameOf,
  subscribeToRemovalRequests,
  type RemovalRequest,
  type RemovalRequestStatus,
} from "@/lib/residentRemovals"
import type { KonodalUser } from "@/types/user"

function fullName(user: KonodalUser | undefined, uid: string): string {
  if (!user) return uid
  return `${user.name} ${user.surname}`.trim() || user.email || uid
}

// Demandes de retrait envoyées par les membres du CS (annuaire des voisins
// de l'app). « Bloquer l'accès » suspend l'accès du résident à CETTE
// résidence sans rien supprimer (lots, publications, messages) et lui
// retire son rôle CS ; « Lever le blocage » depuis sa fiche utilisateur.
export default function RemovalRequestsPage() {
  const [requests, setRequests] = useState<RemovalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<RemovalRequestStatus | null>(null)
  const [users, setUsers] = useState<Record<string, KonodalUser>>({})
  const [residenceNames, setResidenceNames] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<RemovalRequest | null>(null)

  useEffect(() => {
    return subscribeToRemovalRequests(
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

  useEffect(() => {
    const uids = requests.flatMap((r) => [r.targetUid, r.requestedBy]).filter((uid) => !(uid in users))
    if (uids.length > 0) {
      resolveUsersByUids(uids).then((resolved) =>
        setUsers((prev) => ({ ...prev, ...Object.fromEntries(resolved.map((u) => [u.uid, u])) }))
      )
    }
    const residenceIds = [...new Set(requests.map((r) => r.residenceId))].filter((id) => !(id in residenceNames))
    if (residenceIds.length > 0) {
      Promise.all(residenceIds.map(async (id) => [id, await residenceNameOf(id)] as const)).then((entries) =>
        setResidenceNames((prev) => ({ ...prev, ...Object.fromEntries(entries) }))
      )
    }
    // users/residenceNames lus seulement pour éviter les relectures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests])

  const sorted = useMemo(
    () =>
      requests
        .filter((r) => statusFilter === null || r.status === statusFilter)
        .sort((a, b) => Number(a.status !== "pending") - Number(b.status !== "pending")),
    [requests, statusFilter]
  )
  const countBy = (status: RemovalRequestStatus) => requests.filter((r) => r.status === status).length
  const toggleFilter = (status: RemovalRequestStatus) => setStatusFilter((prev) => (prev === status ? null : status))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[26px] font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">Demandes de retrait</h1>
        <Button variant="outline" render={<Link to="/residents" />}>
          Utilisateurs
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FilterKpiCard
          label="En attente"
          value={countBy("pending")}
          icon={Clock}
          colorClass="bg-amber-100 text-amber-600"
          active={statusFilter === "pending"}
          onClick={() => toggleFilter("pending")}
        />
        <FilterKpiCard
          label="Accès bloqués"
          value={countBy("accepted")}
          icon={Ban}
          colorClass="bg-rose-100 text-rose-600"
          active={statusFilter === "accepted"}
          onClick={() => toggleFilter("accepted")}
        />
        <FilterKpiCard
          label="Refusées"
          value={countBy("rejected")}
          icon={XCircle}
          colorClass="bg-slate-100 text-slate-600"
          active={statusFilter === "rejected"}
          onClick={() => toggleFilter("rejected")}
        />
      </div>

      <div className="overflow-hidden rounded-[24px] border border-[oklch(93%_0.005_100)] bg-white shadow-[0_1px_2px_oklch(20%_0_0/0.03),0_14px_34px_-22px_oklch(20%_0_0/0.12)]">
        <div className="px-7 pt-[26px] pb-5">
          <h2 className="mb-1 text-[17px] font-bold text-[oklch(22%_0.01_150)]">Signalements du conseil syndical</h2>
          <p className="text-[13.5px] text-muted-foreground">
            Bloquer l'accès suspend le résident pour cette résidence uniquement : ses lots, publications et messages
            sont conservés, il est retiré du conseil syndical et peut écrire au médiateur depuis l'app.
          </p>
        </div>

        {!loading && sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-4 border-t border-[oklch(95%_0.003_100)] px-10 py-16">
            <div className="flex size-16 items-center justify-center rounded-[18px] bg-[oklch(93%_0.05_150)]">
              <Inbox className="size-7 text-[oklch(38%_0.09_155)]" />
            </div>
            <div className="text-center text-base font-bold text-[oklch(24%_0.01_150)]">Aucune demande</div>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Résidence</TableHead>
                <TableHead>Résident concerné</TableHead>
                <TableHead>Demandé par</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white">
              {sorted.map((request) => (
                <TableRow key={request.id} className="cursor-pointer" onClick={() => setSelected(request)}>
                  <TableCell className="text-muted-foreground">
                    {request.createdAt ? request.createdAt.toDate().toLocaleDateString("fr-FR") : "—"}
                  </TableCell>
                  <TableCell className="font-medium">{residenceNames[request.residenceId] ?? "…"}</TableCell>
                  <TableCell>{fullName(users[request.targetUid], request.targetUid)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {fullName(users[request.requestedBy], request.requestedBy)}
                  </TableCell>
                  <TableCell>{REMOVAL_REASON_LABEL[request.reason] ?? request.reason}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={REMOVAL_STATUS_BADGE_CLASS[request.status]}>
                      {REMOVAL_STATUS_LABEL[request.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setSelected(request)}>
                      <Eye />
                      {request.status === "pending" ? "Examiner" : "Voir"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <RemovalRequestDialog
        request={selected}
        users={users}
        residenceName={selected ? residenceNames[selected.residenceId] : undefined}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}

function RemovalRequestDialog({
  request,
  users,
  residenceName,
  onClose,
}: {
  request: RemovalRequest | null
  users: Record<string, KonodalUser>
  residenceName?: string
  onClose: () => void
}) {
  const [rejectReason, setRejectReason] = useState("")
  const [saving, setSaving] = useState<"accept" | "reject" | null>(null)

  async function decide(decision: "accept" | "reject") {
    if (!request) return
    if (decision === "accept" && !confirm("Bloquer l'accès de ce résident à la résidence ?")) return
    setSaving(decision)
    try {
      await decideRemovalRequest(request.id, decision, decision === "reject" ? rejectReason.trim() : undefined)
      toast.success(decision === "accept" ? "Accès bloqué" : "Demande refusée")
      setRejectReason("")
      onClose()
    } catch (err) {
      toast.error("Échec : " + (err as Error).message)
    } finally {
      setSaving(null)
    }
  }

  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {request && (
          <div className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4">
            <DialogHeader className="border-b border-[oklch(95%_0.003_100)] pb-4">
              <span className="text-[11.5px] font-bold tracking-wide text-primary uppercase">
                {residenceName ?? request.residenceId}
              </span>
              <DialogTitle>Demande de retrait</DialogTitle>
            </DialogHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Résident concerné</div>
                  <Link className="font-medium underline" to={`/residents/${request.targetUid}`}>
                    {fullName(users[request.targetUid], request.targetUid)}
                  </Link>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Demandé par (CS)</div>
                  <Link className="font-medium underline" to={`/residents/${request.requestedBy}`}>
                    {fullName(users[request.requestedBy], request.requestedBy)}
                  </Link>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Motif</div>
                <div className="font-medium">{REMOVAL_REASON_LABEL[request.reason] ?? request.reason}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Description</div>
                <p className="whitespace-pre-wrap">{request.description}</p>
              </div>
              {request.attachments.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="text-xs text-muted-foreground">Pièces jointes</div>
                  <div className="flex flex-wrap gap-3">
                    {request.attachments.map((path, i) => (
                      <DocumentThumbnail key={path} path={path} label={`Pièce ${i + 1}`} />
                    ))}
                  </div>
                </div>
              )}
              {request.status === "pending" ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="removal-reject-reason">Motif du refus (en cas de refus)</Label>
                  <textarea
                    id="removal-reject-reason"
                    rows={3}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Transmis au membre du CS qui a fait la demande"
                    className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={REMOVAL_STATUS_BADGE_CLASS[request.status]}>
                    {REMOVAL_STATUS_LABEL[request.status]}
                  </Badge>
                  {request.rejectionReason && (
                    <span className="text-muted-foreground">{request.rejectionReason}</span>
                  )}
                </div>
              )}
            </div>

            {request.status === "pending" && (
              <DialogFooter>
                <Button type="button" variant="outline" disabled={saving !== null} onClick={() => decide("reject")}>
                  <XCircle />
                  Refuser
                </Button>
                <Button
                  variant="destructive"
                  className="bg-destructive text-white hover:bg-destructive/90"
                  disabled={saving !== null}
                  onClick={() => decide("accept")}
                >
                  <Ban />
                  Bloquer l'accès
                </Button>
              </DialogFooter>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
