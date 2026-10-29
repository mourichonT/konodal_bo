import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { migrateLicences, type LicenceMigrationReport } from "@/lib/billing"
import { formatCents } from "@/lib/licences"
import { PRIMARY_CTA_CLASS } from "@/lib/utils"

// Migration d'une agence de l'ancienne formule (prix par siège) vers les
// licences service / agent (superAdmin) : bilan à blanc affiché d'abord -
// licence de chaque compte, remises conservées, aperçu de la prochaine
// facture - puis migration réelle sur confirmation.
export function LicenceMigrationDialog({ geranceId }: { geranceId: string }) {
  const [open, setOpen] = useState(false)
  const [report, setReport] = useState<LicenceMigrationReport | null>(null)
  const [busy, setBusy] = useState(false)

  async function prepare() {
    setOpen(true)
    setReport(null)
    setBusy(true)
    try {
      setReport(await migrateLicences(geranceId, true))
    } catch (err) {
      toast.error("Bilan impossible : " + (err as Error).message)
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  async function migrate() {
    setBusy(true)
    try {
      const result = await migrateLicences(geranceId, false)
      if (result?.migrated) {
        toast.success("Licences migrées")
        setOpen(false)
      } else {
        setReport(result)
        toast.error("Migration non effectuée : voir le bilan")
      }
    } catch (err) {
      toast.error("Migration impossible : " + (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const preview = report?.preview ?? {}

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="w-fit bg-white" onClick={prepare}>
        Préparer la migration
      </Button>
      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent className="sm:max-w-lg">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              migrate()
            }}
            className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4"
          >
            <DialogHeader className="pb-2">
              <DialogTitle>Migrer vers les licences service et agent</DialogTitle>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-2 text-sm">
              {!report ? (
                <p className="text-muted-foreground">Calcul du bilan…</p>
              ) : report.alreadyMigrated ? (
                <p>Cette agence est déjà passée aux licences service et agent.</p>
              ) : (
                <>
                  <div>
                    <p className="m-0 font-semibold">Licences après migration</p>
                    <p className="m-0 text-muted-foreground">
                      {report.services?.length ?? 0} licence(s) service · {report.agents ?? 0} licence(s) agent (au lieu
                      de {report.legacyQuantity} licence(s) de l'ancienne formule)
                    </p>
                  </div>
                  <ul className="m-0 list-disc pl-5">
                    {report.accounts.map((account) => (
                      <li key={account.email}>
                        {account.email} : {account.licence}
                      </li>
                    ))}
                  </ul>
                  <div>
                    <p className="m-0 font-semibold">Remises et codes promo</p>
                    {report.discounts.length === 0 ? (
                      <p className="m-0 text-muted-foreground">Aucune remise sur cet abonnement.</p>
                    ) : (
                      <ul className="m-0 list-disc pl-5">
                        {report.discounts.map((discount, index) => (
                          <li key={index}>
                            {discount.promotionCode ? `Code ${discount.promotionCode} · ` : ""}
                            {discount.name ?? "Remise"} (
                            {discount.percentOff != null
                              ? `${discount.percentOff} %`
                              : formatCents(discount.amountOffCents)}
                            {discount.duration ? `, ${discount.duration}` : ""}, sur l'{discount.level}) :{" "}
                            {discount.action}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="m-0 font-semibold">Prochaine facture (aperçu Stripe)</p>
                    <p className="m-0 text-muted-foreground">
                      Avant : {formatCents(preview.before?.totalCents)}
                      {preview.after?.totalCents != null && ` · après : ${formatCents(preview.after.totalCents)}`}
                      {preview.after?.note && ` · après : ${preview.after.note}`}
                      {preview.afterMigration?.totalCents != null &&
                        ` · après migration : ${formatCents(preview.afterMigration.totalCents)}`}
                    </p>
                  </div>
                  {report.warnings.map((warning) => (
                    <p key={warning} className="m-0 rounded-[10px] bg-amber-50 p-2.5 text-amber-900">
                      {warning}
                    </p>
                  ))}
                  <p className="m-0 text-muted-foreground">
                    Aucune facture n'est émise par la migration (pas de prorata) et la période d'essai est conservée.
                  </p>
                </>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
                Fermer
              </Button>
              {report && !report.alreadyMigrated && !report.blocked && (
                <Button type="submit" disabled={busy} className={PRIMARY_CTA_CLASS}>
                  {busy ? "Migration…" : "Migrer"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
