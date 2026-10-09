import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { BadgeCheck, CheckCircle2, Eye, Home, Search, ShieldQuestion, User as UserIcon, UserX, Users } from "lucide-react"
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
import { subscribeToUsersInScope } from "@/lib/users"
import { subscribeToRemovalRequests } from "@/lib/residentRemovals"
import { useScopedResidenceIds } from "@/hooks/useScopedResidenceIds"
import { useAccountRole } from "@/hooks/useAccountRole"
import { useAllLots } from "@/hooks/useAllLots"
import { cn } from "@/lib/utils"
import type { KonodalUser } from "@/types/user"

type StatusFilter = "all" | "approved" | "unapproved" | "rejected"
const statusFilterLabels: Record<StatusFilter, string> = {
  all: "Tous",
  approved: "Validé",
  unapproved: "Non certifié",
  rejected: "Bloqué",
}

type LotFilter = "all" | "pending"
const lotFilterLabels: Record<LotFilter, string> = {
  all: "Toutes",
  pending: "En attente",
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
  const [lotFilter, setLotFilter] = useState<LotFilter>("all")
  const [certificationFilter, setCertificationFilter] = useState(false)
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
  const { lots: scopedLots, residences } = useAllLots(() => {}, scopedResidenceIds)
  const residenceNameById = useMemo(
    () => new Map(residences.map((r) => [r.id, r.name])),
    [residences]
  )

  // Abonnement ouvert seulement une fois le périmètre connu : pendant son
  // chargement, scopedResidenceIds vaut null (= pas de restriction).
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
  // utilisateurs.
  const allResidents = useMemo(() => users.filter((u) => (u.accountType || "utilisateur") === "utilisateur"), [users])

  // allowedUids (post-approbation, idProprietaire/idLocataire côté lot
  // maître) ne suffit pas seul : un compte dont le lot est encore en attente
  // (isApprovedLot: false) n'y figure pas encore (cf. domain model - ce
  // tableau n'est peuplé qu'après approbation), et disparaîtrait donc
  // entièrement de l'annuaire d'une agence/agent tant que personne ne
  // l'approuve - impossible dans ce cas de savoir qui a besoin d'être
  // validé. pendingLotResidenceIds (dénormalisé côté serveur, cf.
  // types/user.ts) comble ce trou : présent dès la demande, avant toute
  // approbation.
  const residents = useMemo(() => {
    if (!scopedResidenceIds) return allResidents
    const allowedUids = new Set(scopedLots.flatMap((l) => [...l.idProprietaire, ...l.idLocataire]))
    return allResidents.filter(
      (u) =>
        allowedUids.has(u.uid) ||
        u.pendingLotResidenceIds.some((residenceId) => scopedResidenceIds.has(residenceId))
    )
  }, [allResidents, scopedResidenceIds, scopedLots])

  // Même filtre résidence que pendingUsersCount/usePendingUsersCount - une
  // agence/agent ne doit voir que les demandes concernant SES résidences,
  // jamais celles d'une autre gérance.
  const isPendingLot = (user: KonodalUser) =>
    scopedResidenceIds
      ? user.pendingLotResidenceIds.some((residenceId) => scopedResidenceIds.has(residenceId))
      : user.pendingLotResidenceIds.length > 0

  // Comptés sur `residents` (périmètre RBAC), pas `filteredResidents` : les
  // KPI reflètent le total du périmètre, indépendamment des filtres actifs
  // (recherche, dates...) - seul le clic dessus change un filtre, cf.
  // FilterKpiCard ci-dessous.
  const approvedCount = residents.filter((u) => u.isApproved).length
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
      if (statusFilter === "approved" && !user.isApproved) return false
      if (statusFilter === "unapproved" && (user.isApproved || user.rejectionReason)) return false
      if (statusFilter === "rejected" && (user.isApproved || !user.rejectionReason)) return false
      if (lotFilter === "pending" && !isPendingLot(user)) return false
      if (certificationFilter && !isPendingCertification(user)) return false
      if (fromDate && (!user.createdDate || user.createdDate < fromDate)) return false
      if (toDate && (!user.createdDate || user.createdDate > toDate)) return false
      return matchesSearch(user, search)
    })
    // Comptes ayant un lot à valider en tête (tri stable) : depuis que
    // isApproved est automatique, c'est la seule action en attente de la
    // liste - sans ce tri, elle se noyait parmi les comptes "Validé".
    return [...filtered.filter(needsAction), ...filtered.filter((u) => !needsAction(u))]
  }, [residents, search, statusFilter, lotFilter, certificationFilter, dateFrom, dateTo, scopedResidenceIds, isSuperAdmin])

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

      {/* Total/Comptes approuvés réservés Superadmin (approbation d'identité
          hors de portée agence/agent) - Demande en attente (lot) visible à
          tous les rôles, cf. canApprove dans ResidentDetailPage. Cliquer sur
          une carte pilote le même état que les dropdowns "Statut"/"Lot"
          ci-dessous (deux affordances pour le même filtre). */}
      <div className={cn("grid grid-cols-1 gap-4", isSuperAdmin ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3")}>
        {isSuperAdmin && (
          <>
            <FilterKpiCard
              label="Total utilisateurs"
              value={residents.length}
              icon={Users}
              colorClass="bg-slate-100 text-slate-600"
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
            />
            <FilterKpiCard
              label="Comptes approuvés"
              value={approvedCount}
              icon={CheckCircle2}
              colorClass="bg-emerald-100 text-emerald-600"
              active={statusFilter === "approved"}
              onClick={() => setStatusFilter((prev) => (prev === "approved" ? "all" : "approved"))}
            />
          </>
        )}
        <FilterKpiCard
          label="Demande en attente"
          value={pendingLotCount}
          icon={Home}
          colorClass="bg-amber-100 text-amber-600"
          active={lotFilter === "pending"}
          onClick={() => setLotFilter((prev) => (prev === "pending" ? "all" : "pending"))}
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
              Lot : {lotFilterLabels[lotFilter]}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuRadioGroup value={lotFilter} onValueChange={(v) => setLotFilter(v as LotFilter)}>
                <DropdownMenuLabel>Demande de lot</DropdownMenuLabel>
                {(Object.keys(lotFilterLabels) as LotFilter[]).map((value) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    {lotFilterLabels[value]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Statut d'identité réservé superAdmin (cf. matrice de droits) -
              agence/agent ne peuvent de toute façon pas approuver l'identité. */}
          {isSuperAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
                Statut : {statusFilterLabels[statusFilter]}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuRadioGroup
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                >
                  <DropdownMenuLabel>Statut d'identité</DropdownMenuLabel>
                  {(Object.keys(statusFilterLabels) as StatusFilter[]).map((value) => (
                    <DropdownMenuRadioItem key={value} value={value}>
                      {statusFilterLabels[value]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>Du</span>
            <DateInput value={dateFrom} onChange={setDateFrom} />
            <span>au</span>
            <DateInput value={dateTo} onChange={setDateTo} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col">
        <div className="overflow-hidden rounded-[24px] border border-[oklch(93%_0.005_100)] bg-white shadow-[0_1px_2px_oklch(20%_0_0/0.03),0_14px_34px_-22px_oklch(20%_0_0/0.12)]">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Date de la demande</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Lot</TableHead>
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
                  <TableCell>{user.createdDate ? user.createdDate.toLocaleDateString("fr-FR") : "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={user.isApproved ? "default" : "outline"}
                      className={
                        user.isApproved
                          ? undefined
                          : user.rejectionReason
                            ? "border-transparent bg-red-100 text-red-800"
                            : "border-transparent bg-amber-100 text-amber-800"
                      }
                    >
                      {user.isApproved ? "Validé" : user.rejectionReason ? "Bloqué" : "Non certifié"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {isPendingLot(user) ? (
                      <Badge className="border-transparent bg-amber-100 text-amber-800">
                        En attente —{" "}
                        {user.pendingLotResidenceIds
                          // Filtré au périmètre agence/agent : une demande sur
                          // une résidence hors scope n'a rien à faire ici (et
                          // residenceNameById, lui aussi scopé via useAllLots,
                          // ne la résoudrait pas de toute façon).
                          .filter((id) => !scopedResidenceIds || scopedResidenceIds.has(id))
                          .map((id) => residenceNameById.get(id) ?? id)
                          .join(", ")}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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
