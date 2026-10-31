import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  AlertCircle,
  BadgeEuro,
  Building2,
  CalendarClock,
  CalendarX2,
  HelpCircle,
  KeyRound,
  Receipt,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip as InfoTooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getLicenseKpis } from "@/lib/billing"
import {
  billingStatusBadgeClass,
  billingStatusLabels,
  type CsAvanceKpiResidence,
  type LicenseKpis,
  type RevenueForecastActivation,
} from "@/types/billing"

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

const activationSourceLabels: Record<RevenueForecastActivation["source"], string> = {
  trial: "Fin d'essai",
  paused: "En pause",
}

function activationVolume(a: RevenueForecastActivation): string {
  if (a.type === "cs") return `${a.lots} lot(s)`
  return [a.serviceSeats && `${a.serviceSeats} service`, a.agentSeats && `${a.agentSeats} agent`]
    .filter(Boolean)
    .join(" · ")
}

// Prévisionnel : CA une fois tous les essais en cours devenus payants
// (licences et option CS avancé), et activations mois par mois.
// Synthèse en tête de l'onglet : réalisé et actuel (licences et option CS
// avancé additionnées), puis prévisionnel.
function SummaryCard({ kpis }: { kpis: LicenseKpis | null }) {
  const currency = kpis?.currency ?? "eur"
  const lic = kpis?.totals
  const cs = kpis?.csAvance?.totals
  const realized = kpis?.realized
  const f = kpis?.forecast?.totals
  const ready = !!(lic && cs && realized && f)
  const money = (cents: number | undefined) => (ready ? formatAmount(cents ?? 0, currency) : "…")
  const count = (n: number | undefined) => (ready ? String(n ?? 0) : "…")
  const payingAgencies = lic ? lic.payingAgencies + lic.pastDueAgencies : 0
  const payingResidences = cs ? cs.activeResidences + cs.pastDueResidences : 0

  if (kpis && !ready) return null

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-[15.5px] font-bold text-foreground">
          <Target className="size-[18px] text-primary" />
          Synthèse
          <span className="text-xs font-normal text-muted-foreground">
            (licences et option CS avancé, hors taxes ; prévisionnel au prix catalogue, hors remises)
          </span>
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <LicenseTile
            label={`CA réalisé ${realized?.year ?? ""}`.trim()}
            icon={Wallet}
            value={money(realized?.yearCents)}
            sub={
              ready && realized
                ? `Ce mois ${formatAmount(realized.monthCents, currency)} · 12 derniers mois ${formatAmount(realized.last12mCents, currency)}`
                : undefined
            }
            description="Factures payées depuis le 1er janvier, hors taxes, à leur date de paiement (licences et option CS avancé)."
          />
          <LicenseTile
            label="CA mensuel actuel"
            icon={TrendingUp}
            value={money(f?.currentMrrCents)}
            sub={
              ready && lic && cs
                ? `Licences ${formatAmount(lic.mrrCents, currency)} · CS avancé ${formatAmount(cs.mrrCents, currency)}`
                : undefined
            }
            description="MRR : abonnements actifs ou en retard de paiement, hors essai et options offertes (licences et option CS avancé)."
          />
          <LicenseTile
            label="Clients payants"
            icon={Building2}
            value={count(payingAgencies + payingResidences)}
            sub={
              ready && lic && cs
                ? `${payingAgencies} agence(s) · ${payingResidences} résidence(s) · + ${lic.trialingAgencies + cs.trialingResidences} en essai`
                : undefined
            }
            description="Agences (licences) et résidences (option CS avancé) dont l'abonnement est actif ou en retard de paiement."
          />
          <LicenseTile
            label="Impayés"
            icon={Receipt}
            value={money(lic && cs ? lic.openInvoicesCents + cs.openInvoicesCents : undefined)}
            sub={ready && lic && cs ? `${lic.openInvoicesCount + cs.openInvoicesCount} facture(s) en attente` : undefined}
            warn={!!lic && !!cs && lic.openInvoicesCount + cs.openInvoicesCount > 0}
            description="Montant restant dû sur les factures de licences et de l'option CS avancé en attente de paiement."
          />
          <LicenseTile
            label="CA prévisionnel mensuel"
            icon={Target}
            value={money(f?.targetMrrCents)}
            sub={
              ready && f
                ? `+ ${formatAmount(f.pendingMrrCents, currency)} à activer`
                  + (f.lostMrrCents ? ` · − ${formatAmount(f.lostMrrCents, currency)} résilié` : "")
                : undefined
            }
            description="CA mensuel une fois toutes les licences et options en essai devenues payantes : chaque essai devient payant à sa fin, un abonnement en pause reprend ; les résiliations programmées sont retirées. Une option seulement offerte (sans abonnement, donc sans payeur) ne compte pas. Prix catalogue, hors remises."
          />
          <LicenseTile
            label="CA prévisionnel annuel"
            icon={TrendingUp}
            value={money(f?.targetArrCents)}
            sub={ready ? "CA prévisionnel mensuel × 12" : undefined}
            description="CA prévisionnel mensuel multiplié par 12."
          />
          <LicenseTile
            label="Licences à activer"
            icon={KeyRound}
            value={count(f && f.pendingServiceSeats + f.pendingAgentSeats)}
            sub={
              ready && f
                ? `${f.pendingServiceSeats} service · ${f.pendingAgentSeats} agent`
                  + (f.pausedSubscriptions ? ` · ${f.pausedSubscriptions} abonnement(s) en pause` : "")
                : undefined
            }
            description="Licences des abonnements d'agence en période d'essai (sans résiliation programmée) ou en pause."
          />
          <LicenseTile
            label="Résidences CS avancé à activer"
            icon={Building2}
            value={count(f?.pendingResidences)}
            sub={f?.offeredResidences ? `+ ${f.offeredResidences} offerte(s) sans abonnement, non comptée(s)` : undefined}
            description="Résidences dont l'abonnement à l'option est en période d'essai : elles deviennent payantes à la fin de l'essai (première facture au payeur de l'abonnement)."
          />
        </div>
      </CardContent>
    </Card>
  )
}

// Prévisionnel mois par mois : CA mensuel activé et CA mensuel prévu, puis
// activations à venir.
function ForecastCard({ kpis }: { kpis: LicenseKpis | null }) {
  const currency = kpis?.currency ?? "eur"
  const forecast = kpis?.forecast
  const t = forecast?.totals
  const monthly = (forecast?.monthly ?? []).map((m) => ({
    ...m,
    label: monthLabel(m.month),
    licences: m.licenceMrrCents / 100,
    cs: m.csMrrCents / 100,
    mrr: m.mrrCents / 100,
  }))
  const lastMonth = forecast?.monthly.at(-1)?.month

  if (kpis && !forecast) return null

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-[15.5px] font-bold text-foreground">
          <CalendarClock className="size-[18px] text-primary" />
          Prévisionnel
          <span className="text-xs font-normal text-muted-foreground">(prix catalogue, hors remises)</span>
        </h2>

        <Card className="rounded-2xl border border-[oklch(94%_0.005_100)] bg-[oklch(98%_0.003_100)] shadow-none">
          <CardContent className="flex flex-col gap-4">
            <h3 className="text-sm font-medium">CA mensuel activé par mois et CA mensuel prévu</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: -4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} />
                  <YAxis
                    yAxisId="activated"
                    tickLine={false}
                    axisLine={false}
                    tick={axisTick}
                    tickFormatter={(v: number) => formatAmount(v * 100, currency)}
                  />
                  <YAxis
                    yAxisId="mrr"
                    orientation="right"
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
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="activated" dataKey="licences" name="Licences activées" stackId="activated" fill="var(--chart-2)" />
                  <Bar
                    yAxisId="activated"
                    dataKey="cs"
                    name="CS avancé activé"
                    stackId="activated"
                    fill="var(--chart-4)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line yAxisId="mrr" dataKey="mrr" name="CA mensuel prévu" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {!!t?.laterMrrCents && lastMonth && (
              <p className="text-xs text-muted-foreground">
                + {formatAmount(t.laterMrrCents, currency)} activés après {monthLabel(lastMonth)}.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-[oklch(94%_0.005_100)] bg-[oklch(98%_0.003_100)] shadow-none">
          <CardContent className="flex flex-col gap-4">
            <h3 className="flex items-center gap-1.5 text-sm font-medium">
              <CalendarClock className="size-4 text-muted-foreground" />
              Activations à venir
            </h3>
            {!forecast ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : forecast.activations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun essai en cours.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Offre</TableHead>
                      <TableHead>Origine</TableHead>
                      <TableHead>Volume</TableHead>
                      <TableHead className="text-right">CA mensuel</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {forecast.activations.map((a) => (
                      <TableRow key={`${a.type}-${a.id}-${a.source}`}>
                        <TableCell className="tabular-nums">
                          {a.date ? a.date.toLocaleDateString("fr-FR") : "—"}
                        </TableCell>
                        <TableCell className="font-medium">
                          <Link to={a.type === "cs" ? `/residences/${a.id}` : "/agences"} className="hover:underline">
                            {a.name}
                          </Link>
                        </TableCell>
                        <TableCell>{a.type === "cs" ? "CS avancé" : "Licences"}</TableCell>
                        <TableCell className="text-muted-foreground">{activationSourceLabels[a.source]}</TableCell>
                        <TableCell className="text-muted-foreground">{activationVolume(a)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatAmount(a.mrrCents, currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  )
}

function csStatusLabel(status: CsAvanceKpiResidence["status"]): string {
  return status === "grant" ? "Offerte" : (billingStatusLabels[status] ?? status)
}

function csStatusBadgeClass(status: CsAvanceKpiResidence["status"]): string {
  return status === "grant"
    ? "border-transparent bg-violet-100 text-violet-800"
    : (billingStatusBadgeClass[status] ?? billingStatusBadgeClass.none)
}

// Option CS avancé (abonnements de résidence) : même appel que les licences,
// bloc csAvance. kpis null pendant le chargement.
function CsAvanceKpisCard({ kpis }: { kpis: LicenseKpis | null }) {
  const currency = kpis?.currency ?? "eur"
  const cs = kpis?.csAvance
  const t = cs?.totals
  const money = (cents: number | undefined) => (t ? formatAmount(cents ?? 0, currency) : "…")
  const count = (n: number | undefined) => (t ? String(n ?? 0) : "…")
  const subscribed = t ? t.activeResidences + t.pastDueResidences : 0
  const monthly = (cs?.monthly ?? []).map((m) => ({ ...m, label: monthLabel(m.month), revenue: m.revenueCents / 100 }))

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-[15.5px] font-bold text-foreground">
          <Building2 className="size-[18px] text-primary" />
          Option CS avancé
          <span className="text-xs font-normal text-muted-foreground">(données Stripe et options offertes)</span>
        </h2>

        {kpis && !cs ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="size-4" />
            Chiffres indisponibles : la fonction get_license_kpis doit être redéployée.
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <LicenseTile
                label="Résidences abonnées"
                icon={Building2}
                value={count(subscribed)}
                sub={
                  t
                    ? `+ ${t.trialingResidences} en essai · ${t.offeredResidences} offerte(s) · ${t.newResidences30d} nouvelle(s) sur 30 j`
                    : undefined
                }
                description="Résidences dont l'abonnement est actif ou en retard de paiement. Celles en période d'essai et celles où l'option est offerte (sans abonnement) sont comptées à part."
              />
              <LicenseTile
                label="Lots facturés"
                icon={KeyRound}
                value={count(t?.billedLots)}
                sub={t ? `+ ${t.offeredLots} lot(s) dans les résidences offertes` : undefined}
                description="Lots des abonnements actifs, en essai ou en retard (ligne « par lot » de l'abonnement)."
              />
              <LicenseTile
                label="MRR"
                icon={TrendingUp}
                value={money(t?.mrrCents)}
                sub={t ? `ARR ${formatAmount(t.arrCents, currency)}` : undefined}
                description="Revenu mensuel récurrent : forfait résidence et lots des abonnements actifs ou en retard, hors essai et options offertes ; un abonnement annuel compte pour 1/12. ARR = MRR × 12."
              />
              <LicenseTile
                label="Revenu moyen par résidence"
                icon={BadgeEuro}
                value={money(t && (subscribed ? Math.round(t.mrrCents / subscribed) : 0))}
                description="MRR divisé par le nombre de résidences abonnées."
              />
              <LicenseTile
                label="Encaissé sur 30 jours"
                icon={Wallet}
                value={money(t?.revenue30dCents)}
                description="Total des factures de l'option payées au cours des 30 derniers jours."
              />
              <LicenseTile
                label="Factures impayées"
                icon={Receipt}
                value={money(t?.openInvoicesCents)}
                sub={t ? `${t.openInvoicesCount} facture(s) · ${t.pastDueResidences} résidence(s) en retard` : undefined}
                warn={!!t && t.openInvoicesCount > 0}
                description="Montant restant dû sur les factures de l'option en attente de paiement (y compris les factures envoyées au syndicat)."
              />
              <LicenseTile
                label="Résiliations programmées"
                icon={CalendarX2}
                value={count(t?.cancelingResidences)}
                warn={!!t && t.cancelingResidences > 0}
                description="Abonnements toujours en cours mais résiliés pour la fin de la période en cours."
              />
              <LicenseTile
                label="Désabonnements sur 30 jours"
                icon={TrendingDown}
                value={count(t?.churnedResidences30d)}
                warn={!!t && t.churnedResidences30d > 0}
                description="Abonnements de résidence terminés au cours des 30 derniers jours."
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="rounded-2xl border border-[oklch(94%_0.005_100)] bg-[oklch(98%_0.003_100)] shadow-none">
                <CardContent className="flex flex-col gap-4">
                  <h3 className="text-sm font-medium">Résidences abonnées en fin de mois</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={axisTick} />
                        <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={chartTooltipStyle} />
                        <Bar dataKey="residences" name="Résidences" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
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
            </div>

            <Card className="rounded-2xl border border-[oklch(94%_0.005_100)] bg-[oklch(98%_0.003_100)] shadow-none">
              <CardContent className="flex flex-col gap-4">
                <h3 className="text-sm font-medium">Résidences</h3>
                {!cs ? (
                  <p className="text-sm text-muted-foreground">Chargement…</p>
                ) : cs.residences.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune résidence avec l'option pour l'instant.</p>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Résidence</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead className="text-right">Lots</TableHead>
                          <TableHead>Formule</TableHead>
                          <TableHead className="text-right">MRR</TableHead>
                          <TableHead>Échéance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cs.residences.map((residence) => (
                          <TableRow key={residence.residenceId}>
                            <TableCell className="font-medium">
                              <Link to={`/residences/${residence.residenceId}`} className="hover:underline">
                                {residence.name}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={csStatusBadgeClass(residence.status)}>
                                {csStatusLabel(residence.status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{residence.lots}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {residence.interval === "year" ? "Annuelle" : residence.interval === "month" ? "Mensuelle" : "—"}
                              {residence.byInvoice ? " · sur facture" : ""}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatAmount(residence.mrrCents, currency)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {residence.currentPeriodEnd
                                ? `${residence.cancelAtPeriodEnd || residence.status === "grant" ? "Fin le " : ""}${residence.currentPeriodEnd.toLocaleDateString("fr-FR")}`
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
          </>
        )}
      </CardContent>
    </Card>
  )
}

// KPI licences (abonnements Stripe par siège) et option CS avancé - Super
// Admin uniquement : vue transverse sur toutes les agences et résidences,
// données lues en direct chez Stripe (get_license_kpis) car l'historique
// mensuel n'existe pas en Firestore.
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
    <div className="flex flex-col gap-6">
      {!error && <SummaryCard kpis={kpis} />}
      {!error && <ForecastCard kpis={kpis} />}
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
                  sub={
                    t
                      ? `${t.serviceSeats} service · ${t.agentSeats} agent (essai compris) · + ${t.trialingSeats} en essai`
                      : undefined
                  }
                  description="Licences des abonnements actifs (ou en retard de paiement, l'accès n'étant pas coupé). Les licences en période d'essai sont comptées à part ; le détail service / agent les inclut."
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
                  description="Revenu mensuel récurrent : licences service et agent facturées × leur prix, hors périodes d'essai. ARR = MRR × 12."
                />
                <LicenseTile
                  label="Revenu moyen par agence"
                  icon={BadgeEuro}
                  value={money(t?.arpaCents)}
                  sub={
                    kpis?.servicePriceCents != null && kpis.agentPriceCents != null
                      ? `Service ${formatAmount(kpis.servicePriceCents, currency)} · agent ${formatAmount(kpis.agentPriceCents, currency)}`
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
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="serviceSeats" name="Service" stackId="licences" fill="var(--chart-2)" />
                          <Bar
                            dataKey="agentSeats"
                            name="Agent"
                            stackId="licences"
                            fill="var(--chart-4)"
                            radius={[4, 4, 0, 0]}
                          />
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
                              <TableHead className="text-right">Service</TableHead>
                              <TableHead className="text-right">Agent</TableHead>
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
                                <TableCell className="text-right tabular-nums">{agency.serviceSeats}</TableCell>
                                <TableCell className="text-right tabular-nums">{agency.agentSeats}</TableCell>
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
      {!error && <CsAvanceKpisCard kpis={kpis} />}
    </div>
  )
}
