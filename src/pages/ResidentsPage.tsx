import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Eye, Search, User as UserIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { subscribeToUsers } from "@/lib/users"
import type { KonodalUser } from "@/types/user"

function matchesSearch(user: KonodalUser, search: string): boolean {
  const haystack = [user.name, user.surname, user.email, user.phone].join(" ").toLowerCase()
  return haystack.includes(search.toLowerCase())
}

export default function ResidentsPage() {
  const [users, setUsers] = useState<KonodalUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    setLoading(true)
    return subscribeToUsers(
      (data) => {
        setUsers(data)
        setLoading(false)
      },
      (error) => {
        toast.error("Impossible de charger les résidents : " + error.message)
        setLoading(false)
      }
    )
  }, [])

  // Les comptes 'professionnel'/'superAdmin' sont créés hors app (backoffice,
  // gérance) et n'ont pas leur place dans un annuaire résidents/bailleurs.
  const residents = useMemo(() => users.filter((u) => (u.accountType || "utilisateur") === "utilisateur"), [users])

  const filteredResidents = useMemo(
    () => residents.filter((user) => matchesSearch(user, search)),
    [residents, search]
  )

  const pendingCount = residents.filter((u) => !u.isApproved).length
  const approvedCount = residents.filter((u) => u.isApproved).length

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Utilisateurs</h1>

      <div className="grid grid-cols-3 gap-4">
        <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
          <CardContent className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">Total résidents / bailleurs</span>
            <span className="text-3xl font-semibold">{residents.length}</span>
          </CardContent>
        </Card>
        <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
          <CardContent className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">En attente d'approbation</span>
            <span className="text-3xl font-semibold">{pendingCount}</span>
          </CardContent>
        </Card>
        <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
          <CardContent className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">Comptes approuvés</span>
            <span className="text-3xl font-semibold">{approvedCount}</span>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
        <CardHeader>
          <CardTitle className="text-lg">Annuaire des résidents / bailleurs</CardTitle>
          <CardDescription>
            Rechercher un compte et approuver son identité (documents vérifiés côté KONODAL).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col">
          <div className="mt-[10px] mb-[50px] flex items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher un résident…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-full pl-9"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
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
              <TableBody>
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
                        ? "Aucun résident pour l'instant."
                        : "Aucun résultat pour cette recherche."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            {filteredResidents.length} résident{filteredResidents.length > 1 ? "s" : ""} affiché
            {filteredResidents.length > 1 ? "s" : ""} sur {residents.length}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
