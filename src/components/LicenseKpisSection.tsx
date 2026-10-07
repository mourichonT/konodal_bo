import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  AlertCircle,
  BadgeEuro,
  Building2,
  CalendarX2,
  HelpCircle,
  KeyRound,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip as InfoTooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getLicenseKpis } from "@/lib/billing"
import { billingStatusBadgeClass, billingStatusLabels, type LicenseKpis } from "@/types/billing"

function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })
}

const chartTooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  fontSize: 12,
}
const axisTick = { fill: "var(--muted-foreground)", fontSize: 12 }

function LicenseTile({
  label,
  value,
  sub,
  icon: Icon,
  description,
  warn,
}: {
  label: string
  value: string
  sub?: string
  icon: typeof KeyRound
  description: string
  warn?: boolean
}) {
  return (
    <Card className="rounded-2xl border border-[oklch(94%_0.005_100)] bg-[oklch(98%_0.003_100)] shadow-none">
      <CardContent className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            {label}
            <InfoTooltip>
              <TooltipTrigger render={<span />} className="text-muted-foreground/50 hover:text-muted-foreground">
                <HelpCircle className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>{description}</TooltipContent>
            </InfoTooltip>
          </span>
          <span className="text-2xl font-extrabold tabular-nums">{value}</span>
          {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
        </div>
        <div
          className={`flex size-[30px] shrink-0 items-center justify-center rounded-[9px] ${
            warn ? "bg-amber-100 text-amber-700" : "bg-accent text-accent-foreground"
          }`}
        >
          <Icon className="size-[15px]" />
        </div>
      </CardContent>
    </Card>
  )
}

// KPI licences (abonnements Stripe par siège) - Super Admin uniquement :
// vue transverse sur toutes les agences, données lues en direct chez Stripe
// (get_license_kpis) car l'historique mensuel n'existe pas en Firestore.
export function LicenseKpisSection() {
  const [kpis, setKpis] = useState<LicenseKpis | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getLicenseKpis()
      .then((data) => !cancelled && setKpis(data))
      .catch((err: Error) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [])

  const currency = kpis?.currency ?? "eur"
  const t = kpis?.totals
  const money = (cents: number | undefined) => (t ? formatAmount(cents ?? 0, currency) : "…")
  const count = (n: number | undefined) => (t ? String(n ?? 0) : "…")
  const monthly = (kpis?.monthly ?? []).map((m) => ({
    ...m,
    label: monthLabel(m.month),
    revenue: m.revenueCents / 100,
  }))

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-[15.5px] font-bold text-foreground">
          <KeyRound className="size-[18px] text-primary" />
          Licences
          <span className="text-xs font-normal text-muted-foreground">(données Stripe, toutes agences)</span>
        </h2>

        {error ? (
          <p className="flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="size-4" />
            Impossible de charger les KPI de licences : {error}
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <LicenseTile
                label="Licences actives"
                icon={KeyRound}
                value={count(t && t.activeSeats + t.pastDueSeats)}
                sub={t ? `+ ${t.trialingSeats} en période d'essai` : undefined}
                description="Sièges des abonnements actifs (ou en retard de paiement, l'accès n'étant pas coupé). Les sièges en période d'essai sont comptés à part."
              />
              <LicenseTile
                label="Agences abonnées"
                icon={Building2}
                value={count(t && t.payingAgencies + t.pastDueAgencies)}
                sub={t ? `+ ${t.trialingAgencies} en essai · ${t.newAgencies30d} nouvelle(s) sur 30 j` : undefined}
                description="Agences ayant un abonnement actif ou en retard de paiement."
              />
              <LicenseTile
                label="MRR"
                icon={TrendingUp}
                value={money(t?.mrrCents)}
                sub={t ? `ARR ${formatAmount(t.arrCents, currency)}` : undefined}
                description="Revenu mensuel récurrent : sièges facturés × prix du siège, hors périodes d'essai. ARR = MRR × 12."
              />
              <LicenseTile
                label="Revenu moyen par agence"
                icon={BadgeEuro}
                value={money(t?.arpaCents)}
                sub={
                  kpis?.pricePerSeatCents != null
                    ? `Prix du siège : ${formatAmount(kpis.pricePerSeatCents, currency)}`
                    : undefined
                }
                description="MRR divisé par le nombre d'agences abonnées (ARPA)."
              />
              <LicenseTile
                label="Encaissé sur 30 jours"
                icon={Wallet}
                value={money(t?.revenue30dCents)}
                description="Total des factures de licences payées au cours des 30 derniers jours."
              />
              <LicenseTile
                label="Factures impayées"
                icon={Receipt}
                value={money(t?.openInvoicesCents)}
                sub={t ? `${t.openInvoicesCount} facture(s) · ${t.pastDueAgencies} agence(s) en retard` : undefined}
                warn={!!t && t.openInvoicesCount > 0}
                description="Montant restant dû sur les factures de licences en attente de paiement."
              />
              <LicenseTile
                label="Résiliations programmées"
                icon={CalendarX2}
                value={count(t?.cancelingAgencies)}
                sub={t ? `${t.cancelingSeats} licence(s) concernée(s)` : undefined}
                warn={!!t && t.cancelingAgencies > 0}
                description="Abonnements toujours en cours mais résiliés pour la fin de la période en cours."
              />
              <LicenseTile
                label="Désabonnements sur 30 jours"
                icon={TrendingDown}
                value={count(t?.churnedAgencies30d)}
                warn={!!t && t.churnedAgencies30d > 0}
                description="Abonnements d'agence terminés au cours des 30 derniers jours."
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="rounded-2xl border border-[oklch(94%_0.005_100)] bg-[oklch(98%_0.003_100)] shadow-none">
                <CardContent className="flex flex-col gap-4">
                  <h3 className="text-sm font-medium">Licences en fin de mois (12 derniers mois)</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={axisTick} />
                        <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={chartTooltipStyle} />
                        <Bar dataKey="seats" name="Licences" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-[oklch(94%_0.005_100)] bg-[oklch(98%_0.003_100)] shadow-none">
                <CardContent className="flex flex-col gap-4">
                  <h3 className="text-sm font-medium">Licences prises / retirées par mois</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: -20 }} barGap={2}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={axisTick} />
                        <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={chartTooltipStyle} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="addedSeats" name="Prises" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="removedSeats" name="Retirées" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-[oklch(94%_0.005_100)] bg-[oklch(98%_0.003_100)] shadow-none">
                <CardContent className="flex flex-col gap-4">
                  <h3 className="text-sm font-medium">Encaissements mensuels</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: -4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={axisTick}
                          tickFormatter={(v: number) => formatAmount(v * 100, currency)}
                        />
                        <Tooltip
                          cursor={{ fill: "var(--muted)" }}
                          contentStyle={chartTooltipStyle}
                          formatter={(v) => formatAmount(Number(v) * 100, currency)}
                        />
                        <Bar dataKey="revenue" name="Encaissé" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-[oklch(94%_0.005_100)] bg-[oklch(98%_0.003_100)] shadow-none">
                <CardContent className="flex flex-col gap-4">
                  <h3 className="text-sm font-medium">Licences par agence</h3>
                  {!kpis ? (
                    <p className="text-sm text-muted-foreground">Chargement…</p>
                  ) : kpis.agencies.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune agence abonnée pour l'instant.</p>
                  ) : (
                    <div className="max-h-56 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Agence</TableHead>
                            <TableHead>Statut</TableHead>
                            <TableHead className="text-right">Licences</TableHead>
                            <TableHead className="text-right">MRR</TableHead>
                            <TableHead>Échéance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {kpis.agencies.map((agency) => (
                            <TableRow key={agency.geranceId}>
                              <TableCell className="font-medium">
                                <Link to="/agences" className="hover:underline">
                                  {agency.name}
                                </Link>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={billingStatusBadgeClass[agency.status] ?? billingStatusBadgeClass.none}
                                >
                                  {billingStatusLabels[agency.status] ?? agency.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{agency.seats}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatAmount(agency.mrrCents, currency)}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {agency.currentPeriodEnd
                                  ? `${agency.cancelAtPeriodEnd ? "Fin le " : ""}${agency.currentPeriodEnd.toLocaleDateString("fr-FR")}`
                                  : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
