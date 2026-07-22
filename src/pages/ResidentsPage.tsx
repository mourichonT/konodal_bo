import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { CheckCircle2, Clock3, Eye, Search, User as UserIcon, Users } from "lucide-react"
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
import { FilterKpiCard } from "@/components/FilterKpiCard"
import { subscribeToUsers } from "@/lib/users"
import { useScopedResidenceIds } from "@/hooks/useScopedResidenceIds"
import { useAccountRole } from "@/hooks/useAccountRole"
import { useAllLots } from "@/hooks/useAllLots"
import type { KonodalUser } from "@/types/user"

type ApprovalFilter = "pending" | "approved" | null

function matchesSearch(user: KonodalUser, search: string): boolean {
  const haystack = [user.name, user.surname, user.email, user.phone].join(" ").toLowerCase()
  return haystack.includes(search.toLowerCase())
}

export default function ResidentsPage() {
  const [users, setUsers] = useState<KonodalUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>(null)
  const { isAgent, isAgence } = useAccountRole()
  const { scopedResidenceIds } = useScopedResidenceIds()
  // Les utilisateurs ne portent pas de residenceId direct - le périmètre
  // RBAC se déduit des lots qu'ils possèdent/louent dans le périmètre
  // agence/agent (cf. useScopedResidenceIds).
  const { lots: scopedLots } = useAllLots(() => {}, scopedResidenceIds)

  useEffect(() => {
    setLoading(true)
    return subscribeToUsers(
      (data) => {
        setUsers(data)
        setLoading(false)
      },
      (error) => {
        toast.error("Impossible de charger les utilisateurs : " + error.message)
        setLoading(false)
      }
    )
  }, [])

  // Les comptes 'agence'/'agent'/'superAdmin' sont créés hors app
  // (backoffice, gérance) et n'ont pas leur place dans un annuaire
  // utilisateurs.
  const allResidents = useMemo(() => users.filter((u) => (u.accountType || "utilisateur") === "utilisateur"), [users])

  const residents = useMemo(() => {
    if (!scopedResidenceIds) return allResidents
    const allowedUids = new Set(scopedLots.flatMap((l) => [...l.idProprietaire, ...l.idLocataire]))
    return allResidents.filter((u) => allowedUids.has(u.uid))
  }, [allResidents, scopedResidenceIds, scopedLots])

  const filteredResidents = useMemo(
    () =>
      residents.filter((user) => {
        if (approvalFilter === "pending" && user.isApproved) return false
        if (approvalFilter === "approved" && !user.isApproved) return false
        return matchesSearch(user, search)
      }),
    [residents, search, approvalFilter]
  )

  const pendingCount = residents.filter((u) => !u.isApproved).length
  const approvedCount = residents.filter((u) => u.isApproved).length

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Utilisateurs</h1>

      {/* KPI (dont "En attente d'approbation") réservés Agence/Superadmin -
          un simple Agent consulte l'annuaire mais pas ces agrégats, cf.
          matrice de droits BO. */}
      {!isAgent && (
        <div className="grid grid-cols-3 gap-4">
          <FilterKpiCard
            label="Total utilisateurs"
            value={residents.length}
            icon={Users}
            colorClass="bg-slate-100 text-slate-600"
            active={approvalFilter === null}
            onClick={() => setApprovalFilter(null)}
          />
          <FilterKpiCard
            label="En attente d'approbation"
            value={pendingCount}
            icon={Clock3}
            colorClass="bg-amber-100 text-amber-600"
            active={approvalFilter === "pending"}
            onClick={() => setApprovalFilter((prev) => (prev === "pending" ? null : "pending"))}
          />
          <FilterKpiCard
            label="Comptes approuvés"
            value={approvedCount}
            icon={CheckCircle2}
            colorClass="bg-emerald-100 text-emerald-600"
            active={approvalFilter === "approved"}
            onClick={() => setApprovalFilter((prev) => (prev === "approved" ? null : "approved"))}
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <h2 className="text-lg">Annuaire des utilisateurs</h2>
        <p className="text-sm text-muted-foreground">
          Rechercher un compte et approuver son identité (documents vérifiés côté KONODAL).
        </p>
      </div>

      <div className="relative max-w-sm flex-1">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher un utilisateur…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {isAgence ? (
        <div className="flex flex-col gap-3">
          {filteredResidents.map((user) => (
            <ResidentCard key={user.uid} user={user} />
          ))}
          {!loading && filteredResidents.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">
              {residents.length === 0 ? "Aucun utilisateur pour l'instant." : "Aucun résultat pour cette recherche."}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="overflow-hidden rounded-xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] ring-1 ring-foreground/10">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
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
                        {user.name || user.surname ? `${user.name} ${user.surname}`.trim() : "—"}
                      </div>
                    </TableCell>
                    <TableCell>{user.email || "—"}</TableCell>
                    <TableCell>{user.createdDate ? user.createdDate.toLocaleDateString("fr-FR") : "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={user.isApproved ? "default" : "outline"}
                        className={!user.isApproved ? "border-transparent bg-amber-100 text-amber-800" : undefined}
                      >
                        {user.isApproved ? "Approuvé" : "En attente"}
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
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
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
      )}
    </div>
  )
}

// Vue Agence (RBAC) : une Card par utilisateur, tout visible directement -
// même philosophie que la fiche Agence (OwnAgencyPage), plutôt que le
// tableau générique réservé à superAdmin/agent.
function ResidentCard({ user }: { user: KonodalUser }) {
  return (
    <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <UserIcon className="size-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-medium">
              {user.name || user.surname ? `${user.name} ${user.surname}`.trim() : "—"}
            </span>
            <span className="text-sm text-muted-foreground">{user.email || "—"}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {user.createdDate ? user.createdDate.toLocaleDateString("fr-FR") : "—"}
          </span>
          <Badge
            variant={user.isApproved ? "default" : "outline"}
            className={!user.isApproved ? "border-transparent bg-amber-100 text-amber-800" : undefined}
          >
            {user.isApproved ? "Approuvé" : "En attente"}
          </Badge>
          <Button variant="outline" size="sm" render={<Link to={`/residents/${user.uid}`} />}>
            <Eye />
            Voir la fiche
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
