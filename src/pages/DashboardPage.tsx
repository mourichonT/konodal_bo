import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Building2,
  Users,
  TriangleAlert,
  Flame,
  Wrench,
  BookUser,
  Clock3,
  CheckCircle2,
  UserCheck,
  KeyRound,
  ChevronDown,
  X,
  Contact2,
  FileCheck2,
  Copy,
  HelpCircle,
  PlusCircle,
  Repeat,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useScopedResidenceIds } from "@/hooks/useScopedResidenceIds"
import { useAccountRole } from "@/hooks/useAccountRole"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DateInput } from "@/components/DateInput"
import {
  Tooltip as InfoTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAllSinistres } from "@/hooks/useAllSinistres"
import { useAllEvents } from "@/hooks/useAllEvents"
import { useAllContacts } from "@/hooks/useAllContacts"
import { useAllLots } from "@/hooks/useAllLots"
import { subscribeToUsers } from "@/lib/users"
import type { KonodalUser } from "@/types/user"
import {
  SINISTRE_STATUSES,
  sinistreStatusLabels,
  sinistreStatusDotClass,
  SINISTRE_PRIORITIES,
  sinistrePriorityLabels,
} from "@/types/sinistre"

const priorityColor: Record<(typeof SINISTRE_PRIORITIES)[number], string> = {
  haute: "#f97316",
  normale: "#f59e0b",
  basse: "#3b82f6",
}

type Kpi = {
  label: string
  to: string
  icon: typeof Building2
  value: number
  unit?: string
  sub?: string
  accentClass?: string
  description: string
}

// Jours ouvrés (lun-ven) écoulés entre deux dates, à la granularité du jour
// calendaire (l'heure exacte de la transition Firestore n'est pas prise en
// compte) - suffisant pour une moyenne affichée au dashboard.
function businessDaysBetween(start: Date, end: Date): number {
  if (end <= start) return 0
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)
  cursor.setDate(cursor.getDate() + 1)
  const endDay = new Date(end)
  endDay.setHours(0, 0, 0, 0)
  let count = 0
  while (cursor <= endDay) {
    const day = cursor.getDay()
    if (day !== 0 && day !== 6) count++
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

// Fenêtre de mois pour les graphiques d'évolution : suit la plage de dates
// sélectionnée dans le filtre (dateFrom/dateTo) quand elle est renseignée,
// sinon les 6 derniers mois glissants jusqu'à aujourd'hui.
function monthsInRange(dateFrom: string, dateTo: string, now: Date): { key: string; label: string }[] {
  const end = dateTo ? new Date(`${dateTo}T00:00:00`) : now
  const start = dateFrom
    ? new Date(`${dateFrom}T00:00:00`)
    : new Date(end.getFullYear(), end.getMonth() - 5, 1)
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const last = new Date(end.getFullYear(), end.getMonth(), 1)
  const months: { key: string; label: string }[] = []
  while (cursor <= last) {
    months.push({
      key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
      label: cursor.toLocaleDateString("fr-FR", { month: "short", year: "numeric" }),
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return months
}

function KpiCard({
  label,
  to,
  icon: Icon,
  value,
  unit,
  sub,
  accentClass,
  description,
  loading,
}: Kpi & { loading: boolean }) {
  return (
    <Link to={to} className="group">
      <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-shadow group-hover:shadow-md">
        <CardContent className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                {label}
                <InfoTooltip>
                  <TooltipTrigger
                    render={<span />}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    className="text-muted-foreground/50 hover:text-muted-foreground"
                  >
                    <HelpCircle className="size-3.5" />
                  </TooltipTrigger>
                  <TooltipContent>{description}</TooltipContent>
                </InfoTooltip>
              </span>
              {sub && (
                <Badge variant="outline" className="w-fit border-transparent bg-amber-100 text-amber-800">
                  {sub}
                </Badge>
              )}
            </div>
            <span className="text-3xl font-semibold tabular-nums">
              {loading ? "…" : value}
              {!loading && unit && (
                <span className="ml-1 text-base font-normal text-muted-foreground">{unit}</span>
              )}
            </span>
          </div>
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${accentClass ?? "bg-accent text-accent-foreground"}`}
          >
            <Icon className="size-5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<KonodalUser[]>([])
  const { scopedResidenceIds } = useScopedResidenceIds()
  const { isAgent } = useAccountRole()
  const { sinistres, loading: sinistresLoading } = useAllSinistres((message) => toast.error(message), scopedResidenceIds)
  const { events, residences, loading: eventsLoading } = useAllEvents((message) => toast.error(message), scopedResidenceIds)
  const { contacts, loading: contactsLoading } = useAllContacts((message) => toast.error(message), scopedResidenceIds)
  const { lots, loading: lotsLoading } = useAllLots((message) => toast.error(message), scopedResidenceIds)
  const [residenceFilter, setResidenceFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [fillRateView, setFillRateView] = useState<"percent" | "count">("percent")

  useEffect(() => {
    return subscribeToUsers(
      (data) => setUsers(data),
      (error) => toast.error("Impossible de charger les utilisateurs : " + error.message)
    )
  }, [])

  const loading = sinistresLoading || eventsLoading || contactsLoading || lotsLoading

  const residents = useMemo(
    () => users.filter((u) => (u.accountType || "utilisateur") === "utilisateur"),
    [users]
  )

  const residenceOptions = useMemo(
    () => [...residences].sort((a, b) => a.name.localeCompare(b.name)).map((r) => [r.id, r.name] as const),
    [residences]
  )

  // Résidences/lots/contacts restreints à la résidence sélectionnée dans le
  // filtre - "Utilisateurs" ne peut pas se filtrer directement (un compte
  // n'a pas de residenceId), on le restreint donc via ses lots (propriétaire
  // ou locataire d'un lot de la résidence filtrée).
  const filteredResidences = useMemo(
    () => (residenceFilter === "all" ? residences : residences.filter((r) => r.id === residenceFilter)),
    [residences, residenceFilter]
  )

  const filteredLots = useMemo(
    () => (residenceFilter === "all" ? lots : lots.filter((l) => l.residenceId === residenceFilter)),
    [lots, residenceFilter]
  )
  const ownerIds = useMemo(() => new Set(filteredLots.flatMap((l) => l.idProprietaire)), [filteredLots])
  const tenantIds = useMemo(() => new Set(filteredLots.flatMap((l) => l.idLocataire)), [filteredLots])

  const filteredResidents = useMemo(() => {
    if (residenceFilter === "all") return residents
    const relevantIds = new Set([...ownerIds, ...tenantIds])
    return residents.filter((u) => relevantIds.has(u.uid))
  }, [residents, residenceFilter, ownerIds, tenantIds])
  const filteredUsersPending = filteredResidents.filter((u) => !u.isApproved).length

  const filteredContactsForResidence = useMemo(() => {
    if (residenceFilter === "all") return contacts
    const residence = residences.find((r) => r.id === residenceFilter)
    if (!residence?.contactRefs) return []
    return contacts.filter((c) => residence.contactRefs?.[c.id])
  }, [contacts, residences, residenceFilter])

  // Filtre partagé par les blocs Sinistres/Interventions (résidence + plage
  // de dates) - creationDate pour les sinistres, eventDate pour les
  // interventions, même champ que les pages Sinistres/Interventions.
  const filteredSinistres = useMemo(() => {
    const fromDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null
    const toDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null
    return sinistres.filter((s) => {
      if (residenceFilter !== "all" && s.residenceId !== residenceFilter) return false
      if (fromDate && (!s.creationDate || s.creationDate < fromDate)) return false
      if (toDate && (!s.creationDate || s.creationDate > toDate)) return false
      return true
    })
  }, [sinistres, residenceFilter, dateFrom, dateTo])

  const filteredEvents = useMemo(() => {
    const fromDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null
    const toDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null
    return events.filter((e) => {
      if (residenceFilter !== "all" && e.residenceId !== residenceFilter) return false
      if (fromDate && (!e.eventDate || e.eventDate < fromDate)) return false
      if (toDate && (!e.eventDate || e.eventDate > toDate)) return false
      return true
    })
  }, [events, residenceFilter, dateFrom, dateTo])

  const activeSinistres = useMemo(
    () => filteredSinistres.filter((s) => s.statut !== "Terminé"),
    [filteredSinistres]
  )
  const urgentSinistres = useMemo(
    () => activeSinistres.filter((s) => s.priority === "haute"),
    [activeSinistres]
  )

  const now = new Date()
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const upcomingEvents = useMemo(
    () => filteredEvents.filter((e) => e.eventDate && e.eventDate >= now && e.eventDate <= in7Days),
    [filteredEvents, now, in7Days]
  )
  const avgInterventionDays = useMemo(
    () =>
      average(
        filteredEvents
          .filter((e) => e.creationDate && e.eventDate)
          .map((e) => businessDaysBetween(e.creationDate!, e.eventDate!))
      ),
    [filteredEvents]
  )

  // "Clôturée" = compte-rendu prestataire soumis (termine), même définition
  // que le badge "Terminé" affiché sur les interventions (EvenementDetailPage/
  // EvenementsListPage) - posé par create_shared_rapport.
  const eventsClosedCount = useMemo(
    () => filteredEvents.filter((e) => e.termine).length,
    [filteredEvents]
  )
  // reporte : posé sur l'ANCIENNE intervention par reschedule_shared_intervention
  // (ou le backfill) quand le prestataire reprogramme depuis la page de partage -
  // cf. types/event.ts.
  const eventsReprogrammedCount = useMemo(
    () => filteredEvents.filter((e) => e.reporte).length,
    [filteredEvents]
  )
  // Top 5 des prestataires par nombre d'interventions reportées (donc
  // reprogrammées) - prestaName est recopié tel quel sur la nouvelle
  // intervention par reschedule_shared_intervention, donc stable d'un
  // maillon de la chaîne à l'autre.
  const prestaReprogrammedCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of filteredEvents) {
      if (!e.reporte) continue
      const name = e.prestaName || "—"
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([prestaName, count]) => ({ prestaName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [filteredEvents])
  const eventsClosedRate =
    filteredEvents.length > 0 ? Math.round((eventsClosedCount / filteredEvents.length) * 100) : 0
  const eventsReprogrammedRate =
    filteredEvents.length > 0 ? Math.round((eventsReprogrammedCount / filteredEvents.length) * 100) : 0

  const contactsPending = filteredContactsForResidence.filter((c) => !c.isApproved).length

  // "Fiche complète" : au-delà du minimum imposé par le formulaire (nom +
  // téléphone), tous les champs de coordonnées utiles sont renseignés - web
  // exclu, beaucoup de prestataires n'en ont pas.
  const completeContacts = filteredContactsForResidence.filter(
    (c) => c.name && c.phone && c.mail && c.address.street && c.address.zipCode && c.address.city
  ).length
  const completeContactsRate =
    filteredContactsForResidence.length > 0
      ? Math.round((completeContacts / filteredContactsForResidence.length) * 100)
      : 0

  const duplicateContacts = filteredContactsForResidence.filter(
    (c) => c.likelyDuplicateIds.length > 0
  ).length

  const residencesWithoutContactRate = useMemo(() => {
    if (filteredResidences.length === 0) return 0
    const withoutContact = filteredResidences.filter(
      (r) => !r.contactRefs || !Object.values(r.contactRefs).some(Boolean)
    ).length
    return Math.round((withoutContact / filteredResidences.length) * 100)
  }, [filteredResidences])

  // Évolution du taux de remplissage : parmi les utilisateurs référencés sur
  // au moins un lot (idProprietaire, filtré à la résidence sélectionnée),
  // combien s'étaient déjà inscrits (createdDate) à la fin de chaque mois de
  // la fenêtre - montre la progression des inscriptions propriétaire par
  // rapport au parc de lots.
  const fillRateEvolution = useMemo(() => {
    const totalLots = filteredLots.length
    return monthsInRange(dateFrom, dateTo, now).map(({ key, label }) => {
      const [year, monthIndex] = key.split("-").map(Number)
      const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999)
      const registeredCount = users.filter(
        (u) => ownerIds.has(u.uid) && u.createdDate && u.createdDate <= monthEnd
      ).length
      return {
        key,
        label,
        rate: totalLots > 0 ? Math.round((registeredCount / totalLots) * 1000) / 10 : 0,
        count: registeredCount,
      }
    })
  }, [filteredLots, users, ownerIds, dateFrom, dateTo, now])

  const avgTraitementDays = useMemo(
    () =>
      average(
        filteredSinistres
          .filter((s) => s.declaredDate && s.inProgressDate)
          .map((s) => businessDaysBetween(s.declaredDate!, s.inProgressDate!))
      ),
    [filteredSinistres]
  )

  const avgResolutionDays = useMemo(
    () =>
      average(
        filteredSinistres
          .filter((s) => s.declaredDate && s.closedDate)
          .map((s) => businessDaysBetween(s.declaredDate!, s.closedDate!))
      ),
    [filteredSinistres]
  )

  const statusCounts = useMemo(
    () => SINISTRE_STATUSES.map((statut) => ({
      statut,
      count: filteredSinistres.filter((s) => s.statut === statut).length,
    })),
    [filteredSinistres]
  )
  const maxStatusCount = Math.max(1, ...statusCounts.map((s) => s.count))

  const priorityCounts = useMemo(
    () => SINISTRE_PRIORITIES.map((priority) => ({
      priority,
      label: sinistrePriorityLabels[priority],
      count: filteredSinistres.filter((s) => s.priority === priority).length,
    })),
    [filteredSinistres]
  )

  const monthlyDeclared = useMemo(() => {
    const months = monthsInRange(dateFrom, dateTo, now).map((m) => ({ ...m, count: 0 }))
    const byKey = new Map(months.map((m) => [m.key, m]))
    for (const s of filteredSinistres) {
      if (!s.declaredDate) continue
      const bucket = byKey.get(`${s.declaredDate.getFullYear()}-${s.declaredDate.getMonth()}`)
      if (bucket) bucket.count++
    }
    return months
  }, [filteredSinistres, dateFrom, dateTo, now])

  // "Utilisateurs" (total + badge "en attente d'approbation") réservé
  // Agence/Superadmin, même logique que la page Utilisateurs elle-même -
  // Propriétaires/Locataires restent visibles pour Agent (simples comptages,
  // pas d'info d'approbation).
  const residencesKpis: Kpi[] = [
    {
      label: "Résidences",
      to: "/residences",
      icon: Building2,
      value: filteredResidences.length,
      description: "Nombre total de résidences enregistrées dans le backoffice.",
    },
    ...(isAgent
      ? []
      : [
          {
            label: "Utilisateurs",
            to: "/residents",
            icon: Users,
            value: filteredResidents.length,
            sub: filteredUsersPending > 0 ? `${filteredUsersPending} en attente` : undefined,
            description:
              "Comptes résidents/bailleurs (hors comptes professionnels). Le badge indique ceux en attente d'approbation d'identité.",
          } satisfies Kpi,
        ]),
    {
      label: "Propriétaires",
      to: "/residents",
      icon: UserCheck,
      value: ownerIds.size,
      description:
        "Nombre d'utilisateurs uniques référencés comme propriétaires sur au moins un lot (champ idProprietaire des lots).",
    },
    {
      label: "Locataires",
      to: "/residents",
      icon: KeyRound,
      value: tenantIds.size,
      description:
        "Nombre d'utilisateurs uniques référencés comme locataires sur au moins un lot (champ idLocataire des lots).",
    },
  ]

  const sinistresKpis: Kpi[] = [
    {
      label: "Délai de prise en charge",
      to: "/sinistres/liste",
      icon: Clock3,
      value: Math.round(avgTraitementDays * 10) / 10,
      unit: "j ouvrés",
      accentClass: "bg-sky-100 text-sky-600",
      description:
        "Jours ouvrés moyens entre le passage d'un ticket à \"À traiter\" et son passage à \"En cours\".",
    },
    {
      label: "Délai moyen de résolution",
      to: "/sinistres/liste",
      icon: CheckCircle2,
      value: Math.round(avgResolutionDays * 10) / 10,
      unit: "j ouvrés",
      accentClass: "bg-sky-100 text-sky-600",
      description:
        "Jours ouvrés moyens entre le passage à \"À traiter\" et la clôture (\"Terminé\") du ticket.",
    },
    {
      label: "Sinistres actifs",
      to: "/sinistres/liste",
      icon: TriangleAlert,
      value: activeSinistres.length,
      description: "Nombre de sinistres dont le statut n'est pas \"Terminé\".",
    },
    {
      label: "Sinistres urgents",
      to: "/sinistres/liste",
      icon: Flame,
      value: urgentSinistres.length,
      accentClass: urgentSinistres.length > 0 ? "bg-red-100 text-red-600" : undefined,
      description: "Sinistres actifs dont la priorité est \"Haute\".",
    },
  ]

  const evenementsKpis: Kpi[] = [
    {
      label: "Interventions sous 7 jours",
      to: "/evenements/liste",
      icon: Wrench,
      value: upcomingEvents.length,
      description: "Nombre d'interventions programmées dans les 7 prochains jours.",
    },
    {
      label: "Délai d'intervention",
      to: "/evenements/liste",
      icon: Clock3,
      value: Math.round(avgInterventionDays * 10) / 10,
      unit: "j ouvrés",
      accentClass: "bg-sky-100 text-sky-600",
      description:
        "Jours ouvrés moyens entre la création de l'intervention et sa date programmée.",
    },
  ]

  const contactsKpis: Kpi[] = [
    {
      label: "Total contacts",
      to: "/contacts",
      icon: Contact2,
      value: filteredContactsForResidence.length,
      description: "Nombre total de contacts (prestataires) enregistrés.",
    },
    {
      label: "Fiches complètes",
      to: "/contacts",
      icon: FileCheck2,
      value: completeContactsRate,
      unit: "%",
      description:
        "% de contacts avec nom, téléphone, email et adresse complète renseignés (site web exclu).",
    },
    {
      label: "Contacts en attente",
      to: "/contacts",
      icon: BookUser,
      value: contactsPending,
      description: "Nombre de contacts pas encore approuvés par le backoffice.",
    },
    {
      label: "Doublons potentiels",
      to: "/contacts",
      icon: Copy,
      value: duplicateContacts,
      accentClass: duplicateContacts > 0 ? "bg-amber-100 text-amber-600" : undefined,
      description:
        "Contacts détectés comme doublons probables (même nom normalisé sur des résidences différentes).",
    },
    {
      label: "Résidences sans contact",
      to: "/residences",
      icon: Building2,
      value: residencesWithoutContactRate,
      unit: "%",
      accentClass: residencesWithoutContactRate > 0 ? "bg-amber-100 text-amber-600" : undefined,
      description: "% de résidences n'ayant aucun contact/prestataire rattaché.",
    },
  ]

  const displayName = user?.displayName?.split(" ")[0] || user?.email?.split("@")[0]

  function handleClearFilters() {
    setResidenceFilter("all")
    setDateFrom("")
    setDateTo("")
  }

  return (
    <TooltipProvider delay={150}>
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Bonjour{displayName ? `, ${displayName}` : ""}</h1>
        <p className="text-muted-foreground">
          Bienvenue dans votre espace KONODAL BO, vous pourrez gérer et piloter facilement
          l'application KONODAL APP dans vos résidences
        </p>
      </div>

      <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
        <CardContent className="flex flex-wrap items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-9 w-72 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
              Résidence :{" "}
              {residenceFilter === "all"
                ? "Toutes"
                : (residenceOptions.find(([id]) => id === residenceFilter)?.[1] ?? "Toutes")}
              <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuRadioGroup value={residenceFilter} onValueChange={setResidenceFilter}>
                <DropdownMenuLabel>Résidence</DropdownMenuLabel>
                <DropdownMenuRadioItem value="all">Toutes les résidences</DropdownMenuRadioItem>
                {residenceOptions.map(([id, name]) => (
                  <DropdownMenuRadioItem key={id} value={id}>
                    {name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>Du</span>
            <DateInput value={dateFrom} onChange={setDateFrom} />
            <span>au</span>
            <DateInput value={dateTo} onChange={setDateTo} />
          </div>
          <Button variant="outline" size="sm" className="ml-auto" onClick={handleClearFilters}>
            <X />
            Effacer les filtres
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-4">
            <h2 className="flex items-center gap-2 text-lg">
              <TriangleAlert className="size-5 text-muted-foreground" />
              Sinistres
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {sinistresKpis.map((kpi) => (
                <KpiCard key={kpi.label} {...kpi} loading={loading} />
              ))}
            </div>

            <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
              <CardContent className="flex flex-col gap-4">
                <h3 className="pb-2 text-sm font-medium">Répartition par statut</h3>
                <div className="flex flex-col gap-3">
                  {statusCounts.map(({ statut, count }) => (
                    <div key={statut} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-sm text-muted-foreground">
                        {sinistreStatusLabels[statut]}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${sinistreStatusDotClass[statut]}`}
                          style={{ width: `${(count / maxStatusCount) * 100}%` }}
                        />
                      </div>
                      <span className="w-6 shrink-0 text-right text-sm font-medium tabular-nums">{count}</span>
                    </div>
                  ))}
                </div>

                <h3 className="border-t pt-4 pb-2 text-sm font-medium">Répartition par priorité</h3>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={priorityCounts} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                      />
                      <Tooltip
                        cursor={{ fill: "var(--muted)" }}
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-md)",
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}>
                        {priorityCounts.map(({ priority }) => (
                          <Cell key={priority} fill={priorityColor[priority]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex items-center justify-between gap-3 border-t pt-4">
                  <h3 className="text-sm font-medium">Respect des délais par niveau</h3>
                  {/* À finir : dépend des SLA par priorité, qui seront définis
                      dans les paramètres de compte des agences (pas encore
                      implémentés). */}
                  <Badge variant="secondary">À finaliser</Badge>
                </div>

                <h3 className="border-t pt-4 pb-2 text-sm font-medium">Évolution mensuelle des demandes</h3>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyDeclared} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                      />
                      <Tooltip
                        cursor={{ stroke: "var(--border)" }}
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-md)",
                          fontSize: 12,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        name="À traiter"
                        stroke="var(--chart-4)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4">
            <h2 className="flex items-center gap-2 text-lg">
              <Wrench className="size-5 text-muted-foreground" />
              Interventions
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {evenementsKpis.map((kpi) => (
                <KpiCard key={kpi.label} {...kpi} loading={loading} />
              ))}
            </div>

            <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
              <CardContent className="flex flex-col gap-4">
                <h3 className="text-sm font-medium">Interventions créées / clôturées</h3>
                <div className="flex items-stretch gap-4">
                  <div className="flex flex-1 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
                      <PlusCircle className="size-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-2xl font-semibold tabular-nums">
                        {loading ? "…" : filteredEvents.length}
                      </span>
                      <span className="text-xs text-muted-foreground">Créées</span>
                    </div>
                  </div>
                  <div aria-hidden className="w-px shrink-0 bg-border" />
                  <div className="flex flex-1 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                      <CheckCircle2 className="size-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-2xl font-semibold tabular-nums">
                        {loading ? "…" : eventsClosedCount}
                      </span>
                      <span className="text-xs text-muted-foreground">Clôturées</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${eventsClosedRate}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-xs font-medium text-muted-foreground">
                    {eventsClosedRate}%
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
              <CardContent className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                    <Repeat className="size-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-2xl font-semibold tabular-nums">
                      {loading ? "…" : eventsReprogrammedCount}
                    </span>
                    <span className="text-xs text-muted-foreground">Interventions reprogrammées</span>
                  </div>
                </div>
                {!loading && filteredEvents.length > 0 && (
                  <Badge variant="outline" className="border-transparent bg-amber-100 text-amber-800">
                    {eventsReprogrammedRate}% du total
                  </Badge>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
              <CardContent className="flex flex-col gap-3">
                <h3 className="text-sm font-medium">Prestataires qui reprogramment le plus</h3>
                {prestaReprogrammedCounts.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Aucune intervention reprogrammée.
                  </p>
                ) : (
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={prestaReprogrammedCounts}
                        layout="vertical"
                        margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                        <XAxis
                          type="number"
                          allowDecimals={false}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                        />
                        <YAxis
                          dataKey="prestaName"
                          type="category"
                          width={100}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                        />
                        <Tooltip
                          cursor={{ fill: "var(--muted)" }}
                          contentStyle={{
                            background: "var(--popover)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-md)",
                            fontSize: 12,
                          }}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16} fill="var(--chart-4)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4">
            <h2 className="flex items-center gap-2 text-lg">
              <Building2 className="size-5 text-muted-foreground" />
              Résidences &amp; Utilisateurs
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {residencesKpis.map((kpi) => (
                <KpiCard key={kpi.label} {...kpi} loading={loading} />
              ))}
            </div>

            <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-medium">Évolution du remplissage</h3>
                  <div className="flex items-center gap-1 rounded-lg border border-input p-0.5">
                    <button
                      type="button"
                      onClick={() => setFillRateView("percent")}
                      className={`rounded-md px-2 py-1 text-xs ${fillRateView === "percent" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setFillRateView("count")}
                      className={`rounded-md px-2 py-1 text-xs ${fillRateView === "count" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                    >
                      Nombre
                    </button>
                  </div>
                </div>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={fillRateEvolution} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                      />
                      <YAxis
                        unit={fillRateView === "percent" ? "%" : undefined}
                        allowDecimals={fillRateView === "count" ? false : undefined}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                      />
                      <Tooltip
                        cursor={{ stroke: "var(--border)" }}
                        formatter={(value) => [
                          fillRateView === "percent" ? `${value}%` : value,
                          "Propriétaires référencés",
                        ]}
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-md)",
                          fontSize: 12,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey={fillRateView === "percent" ? "rate" : "count"}
                        name="Propriétaires référencés"
                        stroke="var(--primary)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4">
            <h2 className="flex items-center gap-2 text-lg">
              <BookUser className="size-5 text-muted-foreground" />
              Contacts
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {contactsKpis.map((kpi) => (
                <KpiCard key={kpi.label} {...kpi} loading={loading} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </TooltipProvider>
  )
}
