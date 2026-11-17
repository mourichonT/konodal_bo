import { Children, useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { Building2, Briefcase, RefreshCw, TriangleAlert, Wrench } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SinistrePriorityIcon } from "@/components/SinistrePriorityIcon"
import { fetchResidenceDashboard, type ResidenceDashboard } from "@/lib/residenceDashboard"
import { cn } from "@/lib/utils"

// Onglet « Tableau de bord » de la fiche résidence (16/11/2026) : reprend la
// page du CS de l'app (cs_dashboard_page.dart), mêmes indicateurs, même ordre
// (résidence, sinistres, syndic, prestataires) et mêmes libellés. Ouvert à
// tous les rôles du BO qui voient la résidence (superAdmin, agence, agents) :
// la callable vérifie elle-même le droit. Lecture seule.

// Dernier calcul par résidence pendant la session : revenir sur l'onglet
// affiche tout de suite les chiffres précédents pendant le nouveau calcul.
const lastDashboards = new Map<string, ResidenceDashboard>()

const numberFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 })
const percent = (ratio: number) => `${Math.round(ratio * 100)} %`
const generatedAtFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
})
const UNTITLED = "Sans titre"

function mailDelay(hours: number | null): string {
  if (hours === null) return "—"
  return hours < 48 ? `${numberFormat.format(hours)} h` : `${numberFormat.format(hours / 24)} j`
}

export function ResidenceDashboardTab({ residenceId }: { residenceId: string }) {
  const [data, setData] = useState<ResidenceDashboard | null>(() => lastDashboards.get(residenceId) ?? null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Ignore la réponse d'un calcul dépassé (autre résidence, ou
  // « Actualiser » cliqué pendant un calcul en cours).
  const requestRef = useRef(0)

  const load = useCallback(() => {
    const request = ++requestRef.current
    setLoading(true)
    setError(null)
    fetchResidenceDashboard(residenceId)
      .then((result) => {
        if (request !== requestRef.current) return
        lastDashboards.set(residenceId, result)
        setData(result)
      })
      .catch((err: Error) => {
        if (request === requestRef.current) setError(err.message)
      })
      .finally(() => {
        if (request === requestRef.current) setLoading(false)
      })
  }, [residenceId])

  useEffect(() => {
    setData(lastDashboards.get(residenceId) ?? null)
    load()
  }, [residenceId, load])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {data
            ? `Chiffres des 12 derniers mois, calculés le ${generatedAtFormat.format(new Date(data.generatedAt))}.`
            : "Chiffres des 12 derniers mois, calculés à l'ouverture de l'onglet."}
        </p>
        <Button type="button" variant="outline" size="sm" disabled={loading} onClick={load}>
          <RefreshCw className={cn(loading && "animate-spin")} />
          {loading ? "Calcul en cours…" : "Actualiser"}
        </Button>
      </div>

      {error && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              Impossible de charger le tableau de bord : <span className="text-muted-foreground">{error}</span>
            </p>
            <Button type="button" variant="outline" size="sm" onClick={load}>
              Réessayer
            </Button>
          </CardContent>
        </Card>
      )}

      {!data && loading && (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Calcul du tableau de bord à partir des données de la résidence…
            </p>
          </CardContent>
        </Card>
      )}

      {data && <DashboardContent residenceId={residenceId} data={data} />}
    </div>
  )
}

function DashboardContent({ residenceId, data }: { residenceId: string; data: ResidenceDashboard }) {
  const { coverage, communications, votes, pending, hotspots, resolution, mail, providers } = data
  const coverageRatio = coverage.lots === 0 ? null : coverage.covered / coverage.lots

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Section icon={Building2} title="Résidence">
        <Indicator
          title="Lots avec un occupant inscrit"
          value={coverageRatio === null ? "—" : percent(coverageRatio)}
          caption={`Lots d'habitation : ${coverage.covered} sur ${coverage.lots}`}
        >
          {coverage.buildings.length > 1 &&
            coverage.buildings.map((b, i) => (
              <RatioLine
                key={`${b.name}-${i}`}
                title={b.name || "Sans bâtiment"}
                detail={`${b.covered}/${b.lots}`}
                ratio={b.lots === 0 ? 0 : b.covered / b.lots}
              />
            ))}
        </Indicator>

        <Indicator
          title="Portée des communications du CS"
          value={communications.averageRatio === null ? "—" : percent(communications.averageRatio)}
          caption={
            communications.count === 0
              ? "Aucune communication du CS sur 12 mois."
              : `Part moyenne des résidents qui les ont vues · Communications : ${communications.count}`
          }
        >
          {communications.latest.map((c) => (
            <RatioLine
              key={c.id}
              to={`/communications/${residenceId}/${c.id}`}
              title={c.title || c.text || UNTITLED}
              detail={`${c.views}/${c.public}`}
              ratio={c.ratio ?? 0}
            />
          ))}
        </Indicator>

        <Indicator title="Participation aux votes">
          {votes.length === 0 ? (
            <EmptyLine>Aucun sondage ni vote sur 12 mois.</EmptyLine>
          ) : (
            votes.map((v) => (
              <RatioLine
                key={v.id}
                to={`/residences/${residenceId}/votes/${v.id}`}
                title={v.title || UNTITLED}
                subtitle={[
                  v.type === "assemblee_generale" ? "Assemblée générale" : "Sondage",
                  v.open ? "Ouvert" : "Clos",
                  ...(v.weighted ? [] : ["en lots, tantièmes non renseignés"]),
                ].join(" · ")}
                detail={v.share === null ? "—" : percent(v.share)}
                ratio={v.share ?? 0}
              />
            ))
          )}
        </Indicator>
      </Section>

      <Section icon={TriangleAlert} title="Sinistres">
        <Indicator
          title="En attente chez le syndic"
          value={String(pending.total)}
          chips={[
            ...(pending.high > 0 ? [`Priorité haute : ${pending.high}`] : []),
            ...(pending.stale > 0 ? [`Plus de 30 jours : ${pending.stale}`] : []),
          ]}
        >
          {pending.total === 0 ? (
            <EmptyLine>Aucun sinistre en attente chez le syndic.</EmptyLine>
          ) : (
            pending.oldest.map((s) => (
              <TitleLine
                key={s.id}
                to={`/sinistres/${residenceId}/${s.id}`}
                title={s.title || UNTITLED}
                subtitle={`${s.statut === "En cours" ? "En cours" : "Transmis"} · depuis ${s.days} j`}
                trailing={
                  s.high ? (
                    <span title="Priorité haute">
                      <SinistrePriorityIcon priority="haute" className="size-4" />
                    </span>
                  ) : undefined
                }
              />
            ))
          )}
        </Indicator>

        <Indicator title="Points noirs">
          {hotspots.length === 0 ? (
            <EmptyLine>Aucun lieu ne revient dans les déclarations sur 12 mois.</EmptyLine>
          ) : (
            hotspots.map((h, i) => (
              <TitleLine
                key={`${h.building}|${h.element}|${i}`}
                title={[h.building, h.element].filter((part) => part.trim()).join(" · ")}
                subtitle={`Déclarants : ${h.declarants} · Sinistres : ${h.sinistres}`}
              />
            ))
          )}
        </Indicator>
      </Section>

      <Section icon={Briefcase} title="Syndic">
        <Indicator
          title="Délai de traitement par le syndic"
          value={resolution.medianDays === null ? "—" : `${numberFormat.format(resolution.medianDays)} j ouvrés`}
          caption={
            resolution.medianDays === null
              ? "Aucun sinistre transmis puis terminé sur 12 mois."
              : `Médiane entre la transmission et la clôture · Sinistres terminés : ${resolution.count}`
          }
        />
        <Indicator
          title="Délai de réponse aux mails des résidents"
          value={mailDelay(mail.medianHours)}
          caption={
            mail.messages === 0
              ? "Aucun message envoyé au syndic sur 12 mois."
              : `Médiane jusqu'à la première réponse · Messages répondus : ${mail.answered} sur ${mail.messages}`
          }
          chips={mail.unanswered > 0 ? [`Sans réponse après 7 jours : ${mail.unanswered}`] : []}
        />
      </Section>

      <Section icon={Wrench} title="Prestataires">
        <Indicator
          title="Prestataires à surveiller"
          caption={`Interventions sur 12 mois : ${providers.interventions}`}
        >
          {providers.providers.length === 0 ? (
            <EmptyLine>Aucune intervention reprogrammée ni compte-rendu manquant.</EmptyLine>
          ) : (
            providers.providers.map((p) => (
              <TitleLine
                key={p.name}
                title={p.name}
                subtitle={`Reprogrammées : ${p.rescheduled} · Sans compte-rendu : ${p.withoutReport}`}
              />
            ))
          )}
        </Indicator>
      </Section>
    </div>
  )
}

// ---------- éléments communs ----------

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  children: ReactNode
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-[15.5px] font-bold text-foreground">
          <Icon className="size-[18px] text-primary" />
          {title}
        </h2>
        {children}
      </CardContent>
    </Card>
  )
}

/** Fiche d'un indicateur : libellé, chiffre clé, précision, pastilles, lignes. */
function Indicator({
  title,
  value,
  caption,
  chips = [],
  children,
}: {
  title: string
  value?: string
  caption?: string
  chips?: string[]
  children?: ReactNode
}) {
  // Sans les false/null des affichages conditionnels, avec des clés.
  const rows = Children.toArray(children)
  return (
    <div className="overflow-hidden rounded-2xl border border-[oklch(94%_0.005_100)] bg-[oklch(98%_0.003_100)]">
      <div className="flex flex-col gap-1 p-4">
        <span className="text-sm font-medium">{title}</span>
        {value !== undefined && <span className="text-2xl font-extrabold tabular-nums">{value}</span>}
        {caption && <span className="text-xs text-muted-foreground">{caption}</span>}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1.5">
            {chips.map((chip) => (
              <Badge key={chip} variant="outline" className="border-transparent bg-destructive/10 text-destructive">
                {chip}
              </Badge>
            ))}
          </div>
        )}
      </div>
      {rows.length > 0 && <div className="divide-y border-t">{rows}</div>}
    </div>
  )
}

function Row({ to, children }: { to?: string; children: ReactNode }) {
  const className = "block px-4 py-3"
  return to ? (
    <Link to={to} className={cn(className, "transition-colors hover:bg-muted/60")}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  )
}

function TitleLine({
  title,
  subtitle,
  trailing,
  to,
}: {
  title: string
  subtitle: string
  trailing?: ReactNode
  to?: string
}) {
  return (
    <Row to={to}>
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm">{title}</span>
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        </div>
        {trailing}
      </div>
    </Row>
  )
}

/** Ligne avec une part (0 à 1) : libellé, valeur à droite et barre. */
function RatioLine({
  title,
  subtitle,
  detail,
  ratio,
  to,
}: {
  title: string
  subtitle?: string
  detail: string
  ratio: number
  to?: string
}) {
  return (
    <Row to={to}>
      <div className="flex items-start gap-3">
        <span className="min-w-0 flex-1 truncate text-sm">{title}</span>
        <span className="shrink-0 text-sm font-semibold tabular-nums">{detail}</span>
      </div>
      {subtitle && <span className="mt-0.5 block text-xs text-muted-foreground">{subtitle}</span>}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.min(Math.max(ratio, 0), 1) * 100}%` }}
        />
      </div>
    </Row>
  )
}

function EmptyLine({ children }: { children: ReactNode }) {
  return (
    <Row>
      <span className="text-sm text-muted-foreground">{children}</span>
    </Row>
  )
}
