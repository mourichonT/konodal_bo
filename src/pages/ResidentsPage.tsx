import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { BadgeCheck, Building2, CheckCircle2, Clock, Eye, Home, Search, ShieldQuestion, User as UserIcon, UserX, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FilterKpiCard } from "@/components/FilterKpiCard"
import { DateInput } from "@/components/DateInput"
import { ClearFiltersButton } from "@/components/ClearFiltersButton"
import { subscribeToUsersInScope } from "@/lib/users"
import { subscribeToRemovalRequests } from "@/lib/residentRemovals"
import { useScopedResidenceIds } from "@/hooks/useScopedResidenceIds"
import { useAccountRole } from "@/hooks/useAccountRole"
import { useAllLots } from "@/hooks/useAllLots"
import { cn } from "@/lib/utils"
import { residenceBadgeColors } from "@/lib/residenceColors"
import type { KonodalUser } from "@/types/user"

// Statut d'un compte dans la liste, combinant identité et lots (la
// certification - pièce + selfie vérifiés - n'y figure pas : le badge bleu à
// côté du nom la signale déjà) :
// - "pending" : au moins une demande de lot en attente (À traiter pour
//   Konodal, En cours de validation pour le syndic, qui ne fait que suivre),
//   prioritaire sur tout le reste sauf un blocage ;
// - "validated" : au moins un lot approuvé ;
// - aucun lot : "idValidated" (identité confirmée), ou "registered"
//   (identité non confirmée - cas résiduel depuis que isApproved est posé
//   automatiquement à l'inscription).
type UserStatus = "pending" | "validated" | "idValidated" | "registered" | "blocked"
type StatusFilter = "all" | UserStatus

const STATUS_ORDER: UserStatus[] = ["pending", "validated", "idValidated", "registered", "blocked"]

function statusLabel(status: UserStatus, isSuperAdmin: boolean): string {
  switch (status) {
    case "pending":
      return isSuperAdmin ? "À traiter" : "En cours de validation"
    case "validated":
      return "Validé"
    case "idValidated":
      return "ID confirmée"
    case "registered":
      return "Inscrit"
    case "blocked":
      return "Bloqué"
  }
}

const STATUS_BADGE_CLASS: Record<UserStatus, string> = {
  pending: "border-transparent bg-amber-100 text-amber-800",
  validated: "border-transparent bg-emerald-100 text-emerald-800",
  idValidated: "border-transparent bg-slate-100 text-slate-700",
  registered: "border-transparent bg-slate-50 text-slate-500",
  blocked: "border-transparent bg-red-100 text-red-800",
}

function matchesSearch(user: KonodalUser, search: string): boolean {
  const haystack = [user.name, user.surname, user.email, user.phone].join(" ").toLowerCase()
  return haystack.includes(search.toLowerCase())
}

export default function ResidentsPage() {
  const [users, setUsers] = useState<KonodalUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [certificationFilter, setCertificationFilter] = useState(false)
  const [residenceFilter, setResidenceFilter] = useState("all")
  // Sur createdDate ("Date de la demande" dans le tableau) - "YYYY-MM-DD",
  // même format que DateInput/DashboardPage.
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const { isSuperAdmin } = useAccountRole()
  const [pendingRemovalCount, setPendingRemovalCount] = useState(0)
  useEffect(() => {
    if (!isSuperAdmin) return
    return subscribeToRemovalRequests(
      (requests) => setPendingRemovalCount(requests.filter((r) => r.status === "pending").length),
      () => {}
    )
  }, [isSuperAdmin])
  const { scopedResidenceIds, loading: scopeLoading } = useScopedResidenceIds()
  // Les utilisateurs ne portent pas de residenceId direct - le périmètre
  // RBAC se déduit des lots qu'ils possèdent/louent dans le périmètre
  // agence/agent (cf. useScopedResidenceIds).
  const { lots: scopedLots, residences } = useAllLots(() => {})
  const residenceNameById = useMemo(
    () => new Map(residences.map((r) => [r.id, r.name])),
    [residences]
  )

  // Abonnement ouvert seulement une fois le périmètre connu : pendant son
  // chargement, scopedResidenceIds est vide (portefeuille pas encore lu).
  useEffect(() => {
    if (scopeLoading) return
    setLoading(true)
    return subscribeToUsersInScope(
      scopedResidenceIds,
      (data) => {
        setUsers(data)
        setLoading(false)
      },
      (error) => {
        toast.error("Impossible de charger les utilisateurs : " + error.message)
        setLoading(false)
      }
    )
  }, [scopeLoading, scopedResidenceIds])

  // Les comptes 'agence'/'agent'/'superAdmin' sont créés hors app
  // (backoffice, gérance) et n'ont pas leur place dans un annuaire
  // utilisateurs. Inscriptions abandonnées en cours de route exclues
  // (cf. KonodalUser.signupCompleted).
  const allResidents = useMemo(
    () => users.filter((u) => (u.accountType || "utilisateur") === "utilisateur" && u.signupCompleted),
    [users]
  )

  // Résidences où chaque compte a un lot approuvé (propriétaire ou
  // locataire, idProprietaire/idLocataire côté lot) - lots déjà limités au
  // périmètre (useAllLots).
  const residenceIdsByUid = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const lot of scopedLots) {
      for (const uid of [...lot.idProprietaire, ...lot.idLocataire]) {
        if (!map.has(uid)) map.set(uid, new Set())
        map.get(uid)!.add(lot.residenceId)
      }
    }
    return map
  }, [scopedLots])

  // Demandes de lot en attente d'un compte, limitées au portefeuille pour
  // une agence/agent : visibles de tous (le syndic suit la demande), mais
  // seul Konodal (superAdmin) les valide.
  const pendingResidenceIdsOf = (user: KonodalUser): string[] =>
    scopedResidenceIds
      ? user.pendingLotResidenceIds.filter((id) => scopedResidenceIds.has(id))
      : user.pendingLotResidenceIds

  // Agence/agent : uniquement les comptes ayant un lot approuvé ou une
  // demande en cours dans le portefeuille.
  const residents = useMemo(() => {
    if (!scopedResidenceIds) return allResidents
    return allResidents.filter(
      (u) => residenceIdsByUid.has(u.uid) || u.pendingLotResidenceIds.some((id) => scopedResidenceIds.has(id))
    )
  }, [allResidents, scopedResidenceIds, residenceIdsByUid])

  // Résidences affichées/filtrables pour un compte : lots approuvés et
  // demandes en cours (badge pointillé).
  const residenceIdsOf = (user: KonodalUser): string[] => [
    ...new Set([...(residenceIdsByUid.get(user.uid) ?? []), ...pendingResidenceIdsOf(user)]),
  ]

  const residenceOptions = useMemo(
    () => [...residences].sort((a, b) => a.name.localeCompare(b.name)).map((r) => [r.id, r.name] as const),
    [residences]
  )

  const isPendingLot = (user: KonodalUser) => pendingResidenceIdsOf(user).length > 0

  const statusOf = (user: KonodalUser): UserStatus => {
    if (user.rejectionReason && !user.isApproved) return "blocked"
    if (isPendingLot(user)) return "pending"
    if (residenceIdsByUid.has(user.uid)) return "validated"
    return user.isApproved || user.isCertified ? "idValidated" : "registered"
  }

  // Comptés sur `residents` (périmètre RBAC), pas `filteredResidents` : les
  // KPI reflètent le total du périmètre, indépendamment des filtres actifs
  // (recherche, dates...) - seul le clic dessus change un filtre, cf.
  // FilterKpiCard ci-dessous.
  const lotValidatedCount = residents.filter((u) => statusOf(u) === "validated").length
  const pendingLotCount = residents.filter(isPendingLot).length
  // Décision de certification réservée superAdmin (cf.
  // CertificationRequestCard) - jamais signalée à agence/agent.
  const isPendingCertification = (user: KonodalUser) =>
    isSuperAdmin && user.certificationStatus === "pending"
  const pendingCertificationCount = residents.filter(isPendingCertification).length
  const needsAction = (user: KonodalUser) => isPendingLot(user) || isPendingCertification(user)

  const filteredResidents = useMemo(() => {
    const fromDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null
    const toDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null
    const filtered = residents.filter((user) => {
      if (statusFilter !== "all" && statusOf(user) !== statusFilter) return false
      if (residenceFilter !== "all" && !residenceIdsOf(user).includes(residenceFilter)) return false
      if (certificationFilter && !isPendingCertification(user)) return false
      if (fromDate && (!user.createdDate || user.createdDate < fromDate)) return false
      if (toDate && (!user.createdDate || user.createdDate > toDate)) return false
      return matchesSearch(user, search)
    })
    // Comptes ayant un lot à valider en tête (tri stable) : depuis que
    // isApproved est automatique, c'est la seule action en attente de la
    // liste - sans ce tri, elle se noyait parmi les comptes "Validé".
    return [...filtered.filter(needsAction), ...filtered.filter((u) => !needsAction(u))]
  }, [residents, search, statusFilter, certificationFilter, residenceFilter, dateFrom, dateTo, residenceIdsByUid, scopedResidenceIds, isSuperAdmin])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[26px] font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">Utilisateurs</h1>
        {isSuperAdmin && (
          <Button variant="outline" render={<Link to="/residents/retraits" />}>
            <UserX />
            Demandes de retrait
            {pendingRemovalCount > 0 && (
              <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[oklch(78%_0.15_75)] px-1 text-[10px] font-bold text-[oklch(25%_0.02_75)]">
                {pendingRemovalCount}
              </span>
            )}
          </Button>
        )}
      </div>

      {/* Cliquer sur une carte pilote le même état que le filtre "Statut"
          ci-dessous (deux affordances pour le même filtre). Certification à
          vérifier réservée superAdmin (cf. CertificationRequestCard). */}
      <div className={cn("grid grid-cols-1 gap-4", isSuperAdmin ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3")}>
        <FilterKpiCard
          label="Total utilisateurs"
          value={residents.length}
          icon={Users}
          colorClass="bg-slate-100 text-slate-600"
          active={statusFilter === "all" && !certificationFilter}
          onClick={() => {
            setStatusFilter("all")
            setCertificationFilter(false)
          }}
        />
        <FilterKpiCard
          label="Lot validé"
          value={lotValidatedCount}
          icon={CheckCircle2}
          colorClass="bg-emerald-100 text-emerald-600"
          active={statusFilter === "validated"}
          onClick={() => setStatusFilter((prev) => (prev === "validated" ? "all" : "validated"))}
        />
        <FilterKpiCard
          label={isSuperAdmin ? "À traiter" : "En cours de validation"}
          value={pendingLotCount}
          icon={Home}
          colorClass="bg-amber-100 text-amber-600"
          active={statusFilter === "pending"}
          onClick={() => setStatusFilter((prev) => (prev === "pending" ? "all" : "pending"))}
        />
        {isSuperAdmin && (
          <FilterKpiCard
            label="Certification à vérifier"
            value={pendingCertificationCount}
            icon={ShieldQuestion}
            colorClass="bg-blue-100 text-blue-600"
            active={certificationFilter}
            onClick={() => setCertificationFilter((prev) => !prev)}
          />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="text-lg">Annuaire des utilisateurs</h2>
        {/* Approbation d'identité réservée superAdmin (cf. matrice de
            droits) - la mention n'a pas de sens pour agence/agent, qui ne
            peuvent de toute façon pas approuver. */}
        {isSuperAdmin && (
          <p className="text-sm text-muted-foreground">
            Rechercher un compte et approuver son identité (documents vérifiés côté KONODAL).
          </p>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un utilisateur…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
              Résidence :{" "}
              {residenceFilter === "all" ? "Toutes" : (residenceNameById.get(residenceFilter) ?? residenceFilter)}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 w-64 overflow-y-auto">
              <DropdownMenuRadioGroup value={residenceFilter} onValueChange={setResidenceFilter}>
                <DropdownMenuLabel>Résidence</DropdownMenuLabel>
                <DropdownMenuRadioItem value="all">Toutes</DropdownMenuRadioItem>
                {residenceOptions.map(([id, name]) => (
                  <DropdownMenuRadioItem key={id} value={id}>
                    {name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
              Statut :{" "}
              {statusFilter === "all" ? "Tous" : statusLabel(statusFilter, isSuperAdmin)}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuRadioGroup value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <DropdownMenuLabel>Statut</DropdownMenuLabel>
                <DropdownMenuRadioItem value="all">Tous</DropdownMenuRadioItem>
                {STATUS_ORDER.map((value) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    {statusLabel(value, isSuperAdmin)}
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

          <ClearFiltersButton
            active={!!search || statusFilter !== "all" || certificationFilter || residenceFilter !== "all" || !!dateFrom || !!dateTo}
            onClick={() => {
              setSearch("")
              setStatusFilter("all")
              setCertificationFilter(false)
              setResidenceFilter("all")
              setDateFrom("")
              setDateTo("")
            }}
          />
        </CardContent>
      </Card>

      <div className="flex flex-col">
        <div className="overflow-hidden rounded-[24px] border border-[oklch(93%_0.005_100)] bg-white shadow-[0_1px_2px_oklch(20%_0_0/0.03),0_14px_34px_-22px_oklch(20%_0_0/0.12)]">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Résidence(s)</TableHead>
                <TableHead>Date de la demande</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white">
              {filteredResidents.map((user) => (
                <TableRow key={user.uid}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                        <UserIcon className="size-4" />
                      </div>
                      <span className="flex items-center gap-1.5">
                        {user.name || user.surname ? `${user.name} ${user.surname}`.trim() : "—"}
                        {user.isCertified && (
                          <span title="Identité certifiée">
                            <BadgeCheck className="size-4 shrink-0 fill-blue-500 text-white" />
                          </span>
                        )}
                        {isPendingCertification(user) && (
                          <Badge className="border-transparent bg-blue-100 text-blue-800">
                            Certification à vérifier
                          </Badge>
                        )}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{user.email || "—"}</TableCell>
                  <TableCell>
                    {residenceIdsOf(user).length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {residenceIdsOf(user).map((id) => {
                          // Couleur propre à la résidence ; une demande encore
                          // en attente se distingue par un contour pointillé et
                          // une horloge.
                          const pending = !residenceIdsByUid.get(user.uid)?.has(id)
                          return (
                            <button
                              key={id}
                              type="button"
                              title={pending ? "Demande en cours - filtrer sur cette résidence" : "Filtrer sur cette résidence"}
                              onClick={() => setResidenceFilter(id)}
                              style={{
                                backgroundColor: residenceBadgeColors(id).background,
                                color: residenceBadgeColors(id).color,
                              }}
                              className={cn(
                                "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[filter] hover:brightness-95",
                                pending ? "border-dashed border-current/50" : "border-transparent"
                              )}
                            >
                              {pending ? <Clock className="size-3" /> : <Building2 className="size-3" />}
                              {residenceNameById.get(id) ?? id}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{user.createdDate ? user.createdDate.toLocaleDateString("fr-FR") : "—"}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_BADGE_CLASS[statusOf(user)]}>
                      {statusOf(user) === "pending" && <span className="size-[6px] rounded-full bg-current" />}
                      {statusLabel(statusOf(user), isSuperAdmin)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" render={<Link to={`/residents/${user.uid}`} />}>
                      <Eye />
                      Voir la fiche
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filteredResidents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    {residents.length === 0
                      ? "Aucun utilisateur pour l'instant."
                      : "Aucun résultat pour cette recherche."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
