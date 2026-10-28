import { useState } from "react"
import { toast } from "sonner"
import { Download, ExternalLink, Send } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { sendCsInvoice, type CsBillingAdmin, type CsInvoiceState } from "@/lib/csAvance"
import { formatAmount, formatDate, formatShortDate } from "./format"

const STATE: Record<CsInvoiceState, { label: string; className: string }> = {
  paid: { label: "Payée", className: "border-transparent bg-emerald-100 text-emerald-800" },
  processing: { label: "Prélèvement en cours", className: "border-transparent bg-sky-100 text-sky-800" },
  pending: { label: "À prélever", className: "border-transparent bg-slate-100 text-slate-800" },
  due: { label: "À régler", className: "border-transparent bg-amber-100 text-amber-800" },
  failed: { label: "Impayée", className: "border-transparent bg-red-100 text-red-800" },
  credit: { label: "Avoir", className: "border-transparent bg-violet-100 text-violet-800" },
}

export function InvoicesCard({
  residenceId,
  data,
  onChanged,
}: {
  residenceId: string
  data: CsBillingAdmin
  onChanged: () => Promise<void>
}) {
  const [sending, setSending] = useState<string | null>(null)

  async function resend(invoiceId: string) {
    setSending(invoiceId)
    try {
      await sendCsInvoice(residenceId, invoiceId)
      toast.success("Facture renvoyée au syndicat")
      await onChanged()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSending(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Factures</CardTitle>
        {data.upcoming && (
          <CardDescription>
            Prochaine facture le {formatDate(data.upcoming.date)} :{" "}
            {formatAmount(data.upcoming.amount, data.upcoming.currency)}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Numéro</TableHead>
                <TableHead>Période</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white">
              {data.invoices.map((invoice) => {
                const state = STATE[invoice.state] ?? STATE.pending
                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="text-muted-foreground">{formatShortDate(invoice.date)}</TableCell>
                    <TableCell className="font-mono text-xs">{invoice.number ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {invoice.periodStart && invoice.periodEnd
                        ? `${formatShortDate(invoice.periodStart)} → ${formatShortDate(invoice.periodEnd)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">{formatAmount(invoice.amount, invoice.currency)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={state.className}>
                        {state.label}
                      </Badge>
                      {invoice.state === "due" && invoice.dueDate && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          avant le {formatShortDate(invoice.dueDate)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {invoice.pdfUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            render={<a href={invoice.pdfUrl} target="_blank" rel="noreferrer" />}
                          >
                            <Download />
                            PDF
                          </Button>
                        )}
                        {invoice.hostedUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            render={<a href={invoice.hostedUrl} target="_blank" rel="noreferrer" />}
                          >
                            <ExternalLink />
                            {invoice.payUrl ? "Lien de paiement" : "Voir"}
                          </Button>
                        )}
                        {invoice.canSend && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={sending === invoice.id}
                            onClick={() => resend(invoice.id)}
                          >
                            <Send />
                            Renvoyer
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {data.invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Aucune facture pour l'instant.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
