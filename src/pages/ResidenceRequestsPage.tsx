import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Check, Eye, Inbox, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/lib/auth-context"
import {
  approveResidenceRequest,
  rejectResidenceRequest,
  requestBuildings,
  subscribeToResidenceRequests,
} from "@/lib/residenceRequests"
import { PRIMARY_CTA_CLASS } from "@/lib/utils"
import type { ResidenceRequest, ResidenceRequestStatus } from "@/types/residenceRequest"

const STATUS_LABEL: Record<ResidenceRequestStatus, string> = {
  pending: "En attente",
  approved: "Validée",
  rejected: "Refusée",
}

const STATUS_BADGE_CLASS: Record<ResidenceRequestStatus, string> = {
  pending: "border-[oklch(85%_0.1_75)] bg-[oklch(96%_0.04_75)] text-[oklch(40%_0.1_60)]",
  approved: "border-[oklch(85%_0.06_150)] bg-[oklch(95%_0.04_150)] text-[oklch(38%_0.09_155)]",
  rejected: "border-[oklch(88%_0.04_25)] bg-[oklch(96%_0.02_25)] text-[oklch(45%_0.12_25)]",
}

function formatDate(request: ResidenceRequest): string {
  return request.createdAt ? request.createdAt.toDate().toLocaleDateString("fr-FR") : "—"
}

function groupByBuilding(request: ResidenceRequest) {
  const groups = new Map<string, ResidenceRequest["lots"]>(requestBuildings(request).map((b) => [b.label, []]))
  for (const lot of request.lots) groups.set(lot.batiment, [...(groups.get(lot.batiment) ?? []), lot])
  return [...groups.entries()]
}

export default function ResidenceRequestsPage() {
  const { user } = useAuth()
  const [requests, setRequests] = useState<ResidenceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState<ResidenceRequest | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)

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
  const sorted = [...requests].sort((a, b) => Number(a.status !== "pending") - Number(b.status !== "pending"))
  const pendingCount = requests.filter((r) => r.status === "pending").length

  function close() {
    setViewing(null)
    setRejecting(false)
    setReason("")
  }

  async function handleApprove() {
    if (!viewing || !user) return
    setBusy(true)
    try {
      const { csMemberUid, emailSent } = await approveResidenceRequest(viewing, user.uid)
      toast.success(
        `Résidence ${viewing.residence.name} créée` +
          (csMemberUid ? ", demandeur ajouté au CS" : " (le demandeur n'a pas encore de compte)") +
          (emailSent ? "" : " - email au demandeur non envoyé")
      )
      close()
    } catch (err) {
      toast.error("Échec de la validation : " + (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleReject() {
    if (!viewing || !user) return
    setBusy(true)
    try {
      const { emailSent } = await rejectResidenceRequest(viewing, reason.trim(), user.uid)
      toast.success("Demande refusée" + (emailSent ? "" : " - email au demandeur non envoyé"))
      close()
    } catch (err) {
      toast.error("Échec du refus : " + (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[26px] font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">Demandes de résidence</h1>

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

        {!loading && requests.length === 0 ? (
          <div className="flex flex-col items-center gap-4 border-t border-[oklch(95%_0.003_100)] px-10 py-16">
            <div className="flex size-16 items-center justify-center rounded-[18px] bg-[oklch(93%_0.05_150)]">
              <Inbox className="size-7 text-[oklch(38%_0.09_155)]" />
            </div>
            <div className="text-center text-base font-bold text-[oklch(24%_0.01_150)]">Aucune demande pour l'instant</div>
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
                <TableRow key={request.id}>
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
                    <div className="flex justify-end gap-2">
                      {request.status === "approved" && request.residenceId && (
                        <Button variant="outline" size="sm" render={<Link to={`/residences/${request.residenceId}`} />}>
                          Résidence
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => setViewing(request)}>
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

      <Dialog open={!!viewing} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {viewing && (
            <>
              <DialogHeader className="pb-2">
                <DialogTitle>{viewing.residence.name}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs font-semibold text-muted-foreground">Adresse</div>
                  <div>{viewing.residence.address.street}</div>
                  {viewing.residence.address.complement && <div>{viewing.residence.address.complement}</div>}
                  <div>
                    {viewing.residence.address.zipCode} {viewing.residence.address.city}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold text-muted-foreground">Demandeur</div>
                  <div>
                    {viewing.requester.firstName} {viewing.requester.lastName} · {viewing.requester.role}
                  </div>
                  <div>{viewing.requester.email}</div>
                  {viewing.requester.phone && <div>{viewing.requester.phone}</div>}
                </div>
              </div>

              <div className="mt-2 text-sm">
                <div className="mb-2 text-xs font-semibold text-muted-foreground">
                  {requestBuildings(viewing).length} bâtiment(s) · {viewing.lots.length} lot(s) · offre gratuite (sans tantièmes ni syndic)
                </div>
                <div className="flex flex-col gap-3">
                  {groupByBuilding(viewing).map(([building, lots]) => (
                    <div key={building} className="rounded-xl border border-[oklch(93%_0.005_100)] p-3">
                      <div className="mb-2 font-semibold">{building}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {lots.length === 0 && <span className="text-muted-foreground">Aucun lot</span>}
                        {lots.map((lot) => (
                          <Badge key={lot.lot} variant="secondary">
                            {lot.lot} · {lot.typeLot}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {viewing.status === "rejected" && viewing.rejectionReason && (
                <p className="text-sm text-muted-foreground">Motif du refus : {viewing.rejectionReason}</p>
              )}

              {viewing.status === "pending" && rejecting && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="reject-reason" className="text-xs font-semibold text-muted-foreground">
                    Motif (envoyé au demandeur, facultatif)
                  </label>
                  <textarea
                    id="reject-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    className="rounded-lg border border-input px-3 py-2 text-sm"
                  />
                </div>
              )}

              {viewing.status === "pending" && (
                <DialogFooter>
                  {rejecting ? (
                    <>
                      <Button variant="outline" onClick={() => setRejecting(false)} disabled={busy}>
                        Annuler
                      </Button>
                      <Button variant="destructive" onClick={handleReject} disabled={busy}>
                        Confirmer le refus
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => setRejecting(true)} disabled={busy}>
                        <X />
                        Refuser
                      </Button>
                      <Button onClick={handleApprove} disabled={busy} className={PRIMARY_CTA_CLASS}>
                        <Check />
                        Valider et créer la résidence
                      </Button>
                    </>
                  )}
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
