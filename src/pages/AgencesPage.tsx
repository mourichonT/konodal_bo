import { useEffect, useMemo, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Briefcase, Pencil, Plus, Save, Search, X } from "lucide-react"
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
  createGerance,
  subscribeToGerances,
  updateGerance,
  type GeranceInput,
} from "@/lib/gerances"
import { emptyAddress } from "@/types/residence"
import {
  emptyAgencyDept,
  serviceTypeLabels,
  type Agent,
  type AgencyDept,
  type Gerance,
  type ServiceType,
} from "@/types/gerance"

const serviceTypes: ServiceType[] = ["serviceSyndic", "geranceLocative"]

function geranceToInput(gerance: Gerance): GeranceInput {
  return {
    name: gerance.name,
    address: gerance.address,
    services: gerance.services,
  }
}

function matchesSearch(gerance: Gerance, search: string): boolean {
  const haystack = [gerance.name, gerance.address.street, gerance.address.zipCode, gerance.address.city]
    .join(" ")
    .toLowerCase()
  return haystack.includes(search.toLowerCase())
}

export default function AgencesPage() {
  const [gerances, setGerances] = useState<Gerance[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Gerance | null>(null)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState("")

  useEffect(() => {
    setLoading(true)
    return subscribeToGerances(
      (data) => {
        setGerances(data)
        setLoading(false)
      },
      (error) => {
        toast.error("Impossible de charger les agences : " + error.message)
        setLoading(false)
      }
    )
  }, [])

  const filteredGerances = useMemo(
    () => gerances.filter((gerance) => matchesSearch(gerance, search)),
    [gerances, search]
  )

  const totalSyndics = gerances.filter((gerance) => gerance.services.serviceSyndic).length
  const totalAgencies = gerances.filter((gerance) => gerance.services.geranceLocative).length

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Agences</h1>

      <div className="grid grid-cols-3 gap-4">
        <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
          <CardContent className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">Total des professionnels de l'immo</span>
            <span className="text-3xl font-semibold">{gerances.length}</span>
          </CardContent>
        </Card>
        <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
          <CardContent className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">Total des syndics</span>
            <span className="text-3xl font-semibold">{totalSyndics}</span>
          </CardContent>
        </Card>
        <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
          <CardContent className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">Total des agences</span>
            <span className="text-3xl font-semibold">{totalAgencies}</span>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
        <CardHeader>
          <CardTitle className="text-lg">Répertoire des agences</CardTitle>
          <CardDescription>Rechercher, filtrer et gérer toutes les agences.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col">
          <div className="mt-[10px] mb-[50px] flex items-center justify-between gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher une agence…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button className="rounded-full" onClick={() => setCreating(true)}>
              <Plus />
              Ajouter une agence
            </Button>
          </div>

          <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Agence</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGerances.map((gerance) => {
                  const activeServices = serviceTypes.filter((type) => gerance.services[type])
                  const primaryContact = activeServices
                    .map((type) => gerance.services[type]?.mail)
                    .find((mail) => mail)
                  return (
                    <TableRow key={gerance.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                            <Briefcase className="size-4" />
                          </div>
                          {gerance.name}
                        </div>
                      </TableCell>
                      <TableCell>{gerance.address.street}</TableCell>
                      <TableCell>{gerance.address.city}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {activeServices.length === 0 && (
                            <span className="text-muted-foreground">—</span>
                          )}
                          {activeServices.map((type) => (
                            <Badge key={type} variant="secondary">
                              {serviceTypeLabels[type]}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{primaryContact || "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => setEditing(gerance)}>
                          <Pencil />
                          Modifier
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {!loading && filteredGerances.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      {gerances.length === 0
                        ? "Aucune agence pour l'instant."
                        : "Aucun résultat pour cette recherche."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            {filteredGerances.length} agence{filteredGerances.length > 1 ? "s" : ""} affichée
            {filteredGerances.length > 1 ? "s" : ""} sur {gerances.length}
          </p>
        </CardContent>
      </Card>

      <GeranceFormDialog
        open={creating}
        onOpenChange={setCreating}
        title="Ajouter une agence"
        onSubmit={async (input) => {
          await createGerance(input)
          toast.success("Agence créée")
          setCreating(false)
        }}
      />

      <GeranceFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="Modifier l'agence"
        initial={editing ? geranceToInput(editing) : undefined}
        onSubmit={async (input) => {
          if (!editing) return
          await updateGerance(editing.id, input)
          toast.success("Agence mise à jour")
          setEditing(null)
        }}
      />
    </div>
  )
}

function GeranceFormDialog({
  open,
  onOpenChange,
  title,
  initial,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  initial?: GeranceInput
  onSubmit: (input: GeranceInput) => Promise<void>
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [street, setStreet] = useState(initial?.address.street ?? emptyAddress.street)
  const [zipCode, setZipCode] = useState(initial?.address.zipCode ?? emptyAddress.zipCode)
  const [city, setCity] = useState(initial?.address.city ?? emptyAddress.city)
  const [services, setServices] = useState<Partial<Record<ServiceType, AgencyDept>>>(
    initial?.services ?? {}
  )
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "")
      setStreet(initial?.address.street ?? emptyAddress.street)
      setZipCode(initial?.address.zipCode ?? emptyAddress.zipCode)
      setCity(initial?.address.city ?? emptyAddress.city)
      setServices(initial?.services ?? {})
    }
  }, [open, initial])

  function toggleService(type: ServiceType, enabled: boolean) {
    setServices((prev) => {
      const next = { ...prev }
      if (enabled) {
        next[type] = next[type] ?? { ...emptyAgencyDept, agents: [] }
      } else {
        delete next[type]
      }
      return next
    })
  }

  function updateDept(type: ServiceType, dept: AgencyDept) {
    setServices((prev) => ({ ...prev, [type]: dept }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit({
        name,
        address: { ...emptyAddress, street, zipCode, city },
        services,
      })
    } catch (err) {
      toast.error("Échec de l'enregistrement : " + (err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4">
          <DialogHeader className="pb-4">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ger-name">Nom de l'agence</Label>
              <Input id="ger-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ger-street">Adresse</Label>
              <Input id="ger-street" required value={street} onChange={(e) => setStreet(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ger-zip">Code postal</Label>
                <Input id="ger-zip" required value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ger-city">Ville</Label>
                <Input id="ger-city" required value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {serviceTypes.map((type) => (
                <ServiceSection
                  key={type}
                  type={type}
                  dept={services[type]}
                  onToggle={(enabled) => toggleService(type, enabled)}
                  onChange={(dept) => updateDept(type, dept)}
                />
              ))}
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

function ServiceSection({
  type,
  dept,
  onToggle,
  onChange,
}: {
  type: ServiceType
  dept?: AgencyDept
  onToggle: (enabled: boolean) => void
  onChange: (dept: AgencyDept) => void
}) {
  const enabled = dept !== undefined

  function addAgent() {
    if (!dept) return
    onChange({
      ...dept,
      agents: [...dept.agents, { name_agent: "", surname_agent: "" }],
    })
  }

  function updateAgent(index: number, agent: Agent) {
    if (!dept) return
    onChange({
      ...dept,
      agents: dept.agents.map((a, i) => (i === index ? agent : a)),
    })
  }

  function removeAgent(index: number) {
    if (!dept) return
    onChange({ ...dept, agents: dept.agents.filter((_, i) => i !== index) })
  }

  return (
    <div className="rounded-lg border p-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="size-4 rounded border-input"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
        />
        {serviceTypeLabels[type]}
      </label>

      {dept && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${type}-mail`}>Email du service</Label>
              <Input
                id={`${type}-mail`}
                type="email"
                value={dept.mail}
                onChange={(e) => onChange({ ...dept, mail: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${type}-phone`}>Téléphone</Label>
              <Input
                id={`${type}-phone`}
                value={dept.phone}
                onChange={(e) => onChange({ ...dept, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Agents</Label>
              <Button type="button" variant="outline" size="sm" onClick={addAgent}>
                <Plus />
                Ajouter un agent
              </Button>
            </div>
            {dept.agents.map((agent, index) => (
              <div key={index} className="flex min-w-0 items-start gap-2 rounded-md bg-muted/50 p-2">
                <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
                  <Input
                    placeholder="Prénom"
                    value={agent.name_agent}
                    onChange={(e) => updateAgent(index, { ...agent, name_agent: e.target.value })}
                  />
                  <Input
                    placeholder="Nom"
                    value={agent.surname_agent}
                    onChange={(e) => updateAgent(index, { ...agent, surname_agent: e.target.value })}
                  />
                  <Input
                    placeholder="Email (optionnel)"
                    type="email"
                    value={agent.mail ?? ""}
                    onChange={(e) => updateAgent(index, { ...agent, mail: e.target.value })}
                  />
                  <Input
                    placeholder="Téléphone (optionnel)"
                    value={agent.phone ?? ""}
                    onChange={(e) => updateAgent(index, { ...agent, phone: e.target.value })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeAgent(index)}
                >
                  <X />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
