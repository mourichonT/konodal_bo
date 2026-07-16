import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Building2, Pencil, Plus, Save, Search } from "lucide-react"
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  createResidence,
  subscribeToResidences,
  updateResidenceGeo,
  type ResidenceInput,
} from "@/lib/residences"
import { geocodeAddress } from "@/lib/geocode"
import { emptyAddress, type Residence } from "@/types/residence"

// maplibre-gl pèse ~600 Ko gzippé : chargé à la demande, seulement par les
// visiteurs de cette page, plutôt que gonfler le bundle principal partagé
// par tout le backoffice.
const ResidencesMap = lazy(() =>
  import("@/components/ResidencesMap").then((m) => ({ default: m.ResidencesMap }))
)

function matchesSearch(residence: Residence, search: string): boolean {
  const haystack = [
    residence.name,
    residence.address.street,
    residence.address.zipCode,
    residence.address.city,
    residence.mail_contact,
  ]
    .join(" ")
    .toLowerCase()
  return haystack.includes(search.toLowerCase())
}

export default function ResidencesPage() {
  const [residences, setResidences] = useState<Residence[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState("")

  useEffect(() => {
    setLoading(true)
    return subscribeToResidences(
      (data) => {
        setResidences(data)
        setLoading(false)
      },
      (error) => {
        toast.error("Impossible de charger les résidences : " + error.message)
        setLoading(false)
      }
    )
  }, [])

  const filteredResidences = useMemo(
    () => residences.filter((residence) => matchesSearch(residence, search)),
    [residences, search]
  )

  // Géocodage paresseux : une résidence sans lat/lng est géocodée une seule
  // fois via l'API Adresse (gratuite, sans clé) puis les coordonnées sont
  // persistées en base - les chargements suivants n'ont donc plus jamais à
  // regéocoder cette résidence. `geocodingRef` évite de relancer une requête
  // pour une résidence déjà en cours de géocodage (l'effet se redéclenche à
  // chaque mise à jour de `residences`, y compris juste après l'écriture).
  const geocodingRef = useRef(new Set<string>())
  useEffect(() => {
    for (const residence of residences) {
      if (residence.lat != null && residence.lng != null) continue
      if (geocodingRef.current.has(residence.id)) continue
      geocodingRef.current.add(residence.id)
      geocodeAddress(residence.address)
        .then((point) => point && updateResidenceGeo(residence.id, point.lat, point.lng))
        .catch(() => {
          // Échec silencieux (adresse introuvable, réseau...) : la résidence
          // reste juste absente de la carte, un prochain chargement retentera.
        })
        .finally(() => geocodingRef.current.delete(residence.id))
    }
  }, [residences])

  const topCities = useMemo(() => {
    const counts = new Map<string, number>()
    for (const residence of residences) {
      const city = residence.address.city?.trim()
      if (!city) continue
      counts.set(city, (counts.get(city) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [residences])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Résidences</h1>

      <div className="flex gap-4">
        <div className="flex w-72 shrink-0 flex-col gap-4">
          <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
            <CardContent className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Total résidences</span>
              <span className="text-3xl font-semibold">{residences.length}</span>
            </CardContent>
          </Card>

          <Card className="flex-1 rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
            <CardHeader>
              <CardTitle className="text-base">Top 5 des villes</CardTitle>
            </CardHeader>
            <CardContent className="h-56">
              {topCities.length === 0 ? (
                <p className="text-sm text-muted-foreground">Pas encore de données.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topCities}
                    layout="vertical"
                    margin={{ top: 0, right: 24, bottom: 0, left: 0 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="city"
                      tickLine={false}
                      axisLine={false}
                      width={70}
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
                    <Bar dataKey="count" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={16}>
                      <LabelList
                        dataKey="count"
                        position="right"
                        style={{ fill: "var(--foreground)", fontSize: 12 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="flex-1 overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
          <CardHeader>
            <CardTitle className="text-lg">Carte des résidences</CardTitle>
            <CardDescription>Localisation géographique de toutes les résidences.</CardDescription>
          </CardHeader>
          <CardContent className="h-96">
            <div className="h-full w-full overflow-hidden rounded-lg ring-1 ring-foreground/10">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Chargement de la carte…
                  </div>
                }
              >
                <ResidencesMap residences={residences} />
              </Suspense>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
        <CardHeader>
          <CardTitle className="text-lg">Répertoire des résidences</CardTitle>
          <CardDescription>Rechercher, filtrer et gérer toutes les résidences.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col">
          <div className="mt-[10px] mb-[50px] flex items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher une résidence…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-full pl-9"
              />
            </div>
            <Button className="rounded-full" onClick={() => setCreating(true)}>
              <Plus />
              Ajouter une résidence
            </Button>
          </div>

          <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead>Code postal</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Lots</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResidences.map((residence) => (
                  <TableRow key={residence.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                          <Building2 className="size-4" />
                        </div>
                        {residence.name}
                      </div>
                    </TableCell>
                    <TableCell>{residence.address.street}</TableCell>
                    <TableCell>{residence.address.zipCode}</TableCell>
                    <TableCell>{residence.address.city}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{residence.totalLot} lots</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" render={<Link to={`/residences/${residence.id}`} />}>
                        <Pencil />
                        Gérer
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filteredResidences.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      {residences.length === 0
                        ? "Aucune résidence pour l'instant."
                        : "Aucun résultat pour cette recherche."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            {filteredResidences.length} résidence{filteredResidences.length > 1 ? "s" : ""} affichée
            {filteredResidences.length > 1 ? "s" : ""} sur {residences.length}
          </p>
        </CardContent>
      </Card>

      <ResidenceFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSubmit={async (input) => {
          await createResidence(input)
          toast.success("Résidence créée")
          setCreating(false)
        }}
      />
    </div>
  )
}

function ResidenceFormDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: ResidenceInput) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [street, setStreet] = useState(emptyAddress.street)
  const [zipCode, setZipCode] = useState(emptyAddress.zipCode)
  const [city, setCity] = useState(emptyAddress.city)
  const [mailContact, setMailContact] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setName("")
      setStreet(emptyAddress.street)
      setZipCode(emptyAddress.zipCode)
      setCity(emptyAddress.city)
      setMailContact("")
    }
  }, [open])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit({
        name,
        address: { ...emptyAddress, street, zipCode, city },
        mail_contact: mailContact,
      })
    } catch (err) {
      toast.error("Échec de l'enregistrement : " + (err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4">
          <DialogHeader className="pb-4">
            <DialogTitle>Ajouter une résidence</DialogTitle>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="res-name">Nom de la résidence</Label>
              <Input id="res-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="res-street">Adresse</Label>
              <Input id="res-street" required value={street} onChange={(e) => setStreet(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="res-zip">Code postal</Label>
                <Input id="res-zip" required value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="res-city">Ville</Label>
                <Input id="res-city" required value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="res-mail">Email de contact</Label>
              <Input
                id="res-mail"
                type="email"
                value={mailContact}
                onChange={(e) => setMailContact(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              <Save />
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
