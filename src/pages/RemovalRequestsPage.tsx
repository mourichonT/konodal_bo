import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Ban, Clock, Inbox, XCircle } from "lucide-react"
import { FilterKpiCard } from "@/components/FilterKpiCard"
import { UsersSectionToggle } from "@/components/UsersSectionToggle"
import { DocumentThumbnail } from "@/components/DocumentThumbnail"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2 && parts[0] && parts[1]) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (name[0] ?? "?").toUpperCase()
}

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
        <h1 className="text-[30px] font-extrabold tracking-tight text-[oklch(20%_0.02_150)]">Demandes de retrait</h1>
        <UsersSectionToggle current="retraits" />
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
          <h2 className="text-lg font-extrabold text-[oklch(20%_0.02_150)]">Signalements du conseil syndical</h2>
          <p className="mt-1.5 max-w-[820px] text-sm leading-normal text-[oklch(50%_0.01_150)]">
            Bloquer l'accès suspend le résident pour cette résidence uniquement : ses lots, publications et messages
            sont conservés, il est retiré du conseil syndical et peut écrire au médiateur depuis l'app.
          </p>
        </div>

        {!loading && sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-3.5 border-t border-[oklch(95%_0.003_100)] px-5 py-16">
            <div className="flex size-20 items-center justify-center rounded-[22px] bg-[oklch(94%_0.05_160)]">
              <Inbox className="size-[34px] text-[oklch(35%_0.09_155)]" />
            </div>
            <div className="text-center text-lg font-extrabold text-[oklch(24%_0.01_150)]">Aucune demande</div>
          </div>
        ) : (
          sorted.map((request) => {
            const target = users[request.targetUid]
            const requester = users[request.requestedBy]
            return (
              <div
                key={request.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(request)}
                onKeyDown={(e) => e.key === "Enter" && setSelected(request)}
                className="flex cursor-pointer flex-wrap items-center gap-4 border-t border-[oklch(95%_0.003_100)] px-7 py-[18px] hover:bg-[oklch(98.5%_0.003_100)]"
              >
                <div className="flex size-[42px] shrink-0 items-center justify-center rounded-[14px] bg-[oklch(94%_0.04_150)] text-sm font-extrabold text-[oklch(35%_0.08_155)]">
                  {initialsOf(fullName(target, "?"))}
                </div>
                <div className="min-w-[240px] flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[15px] font-extrabold text-[oklch(22%_0.01_150)]">
                    {fullName(target, request.targetUid)}
                    <span className="rounded-full bg-[oklch(94%_0.04_285)] px-2.5 py-[3px] text-xs font-bold text-[oklch(40%_0.12_285)]">
                      {residenceNames[request.residenceId] ?? "…"}
                    </span>
                  </div>
                  <div className="mt-1 text-[13px] text-[oklch(50%_0.01_150)]">
                    {REMOVAL_REASON_LABEL[request.reason] ?? request.reason} · Demandé par{" "}
                    {fullName(requester, request.requestedBy)}
                    {request.createdAt ? ` · ${request.createdAt.toDate().toLocaleDateString("fr-FR")}` : ""}
                  </div>
                </div>
                {request.status === "pending" ? (
                  // Décision depuis le dialogue (description, pièces jointes,
                  // motif de refus transmis au CS) : les deux boutons
                  // l'ouvrent, rien n'est décidé sans l'avoir lu.
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="h-9 rounded-[11px] px-4 text-[13px] font-bold"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelected(request)
                      }}
                    >
                      Refuser
                    </Button>
                    <Button
                      className="h-9 rounded-[11px] bg-[oklch(45%_0.17_27)] px-4 text-[13px] font-bold text-white hover:bg-[oklch(40%_0.17_27)]"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelected(request)
                      }}
                    >
                      Bloquer l'accès
                    </Button>
                  </div>
                ) : (
                  <Badge variant="outline" className={REMOVAL_STATUS_BADGE_CLASS[request.status]}>
                    {REMOVAL_STATUS_LABEL[request.status]}
                  </Badge>
                )}
              </div>
            )
          })
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
