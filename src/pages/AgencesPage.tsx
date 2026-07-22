import { useEffect, useMemo, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Briefcase, Check, Home, Landmark, Mail, Pencil, Plus, Save, Search, ShieldOff, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
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
import { FilterKpiCard } from "@/components/FilterKpiCard"
import {
  createGerance,
  inviteAgencyAccount,
  revokeAgencyAccount,
  setAgentAccountUid,
  setDeptAccountUid,
  subscribeToGerances,
  updateGerance,
  type AgencyAccountRole,
  type GeranceInput,
} from "@/lib/gerances"
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin"
import { useAccountRole } from "@/hooks/useAccountRole"
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
  const [allGerances, setAllGerances] = useState<Gerance[]>([])
  const [loading, setLoading] = useState(true)
  // ID plutôt qu'un snapshot Gerance : le statut "compte actif" affiché dans
  // le dialog (posé par inviteAgencyAccount) doit rester à jour en direct
  // pendant que le dialog reste ouvert, pas figé sur l'état au moment du
  // clic "Modifier".
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState("")
  const [serviceFilter, setServiceFilter] = useState<ServiceType | null>(null)
  const { isSuperAdmin, isAgence, isAgent, geranceId: ownGeranceId } = useAccountRole()

  useEffect(() => {
    setLoading(true)
    return subscribeToGerances(
      (data) => {
        setAllGerances(data)
        setLoading(false)
      },
      (error) => {
        toast.error("Impossible de charger les agences : " + error.message)
        setLoading(false)
      }
    )
  }, [])

  // Une agence/agent ne doit voir/gérer que SA PROPRE fiche, jamais
  // l'annuaire complet (coordonnées et agents des autres agences, y compris
  // potentiellement concurrentes) - contrairement à firestore.rules qui
  // laisse la lecture ouverte à tout signed-in (annuaire non scopé
  // résidence par conception, cf. recherche par email côté app), c'est ici
  // une restriction volontaire côté BO.
  const gerances = useMemo(() => {
    if (isSuperAdmin) return allGerances
    if (isAgence || isAgent) return allGerances.filter((g) => g.id === ownGeranceId)
    return []
  }, [allGerances, isSuperAdmin, isAgence, isAgent, ownGeranceId])

  const editingGerance = useMemo(() => gerances.find((g) => g.id === editingId) ?? null, [gerances, editingId])

  const filteredGerances = useMemo(
    () =>
      gerances.filter((gerance) => {
        if (serviceFilter && !gerance.services[serviceFilter]) return false
        return matchesSearch(gerance, search)
      }),
    [gerances, search, serviceFilter]
  )

  const totalSyndics = gerances.filter((gerance) => gerance.services.serviceSyndic).length
  const totalAgencies = gerances.filter((gerance) => gerance.services.geranceLocative).length
  const ownGerance = isAgent ? (gerances[0] ?? null) : null

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Agences</h1>

      {/* Un Agent n'a pas la vue agrégée (KPI sur TOUTES les agences n'a pas
          de sens pour un compte scopé à la sienne) - juste un rappel de son
          agence de rattachement. */}
      {isAgent ? (
        <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Briefcase className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-medium">{ownGerance?.name ?? "…"}</span>
                {ownGerance && (
                  <span className="text-sm text-muted-foreground">
                    {[ownGerance.address.street, [ownGerance.address.zipCode, ownGerance.address.city].join(" ")]
                      .filter(Boolean)
                      .join(" — ") || "—"}
                  </span>
                )}
              </div>
            </div>

            {ownGerance && (
              <div className="flex flex-col gap-3 border-t pt-4">
                {serviceTypes
                  .filter((type) => ownGerance.services[type])
                  .map((type) => {
                    const dept = ownGerance.services[type]
                    if (!dept) return null
                    return (
                      <div key={type} className="flex flex-col gap-1">
                        <Badge variant="secondary" className="w-fit">
                          {serviceTypeLabels[type]}
                        </Badge>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          {dept.mail && <span>{dept.mail}</span>}
                          {dept.phone && <span>{dept.phone}</span>}
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <FilterKpiCard
            label="Total des professionnels de l'immo"
            value={gerances.length}
            icon={Briefcase}
            colorClass="bg-slate-100 text-slate-600"
            active={serviceFilter === null}
            onClick={() => setServiceFilter(null)}
          />
          <FilterKpiCard
            label="Total des syndics"
            value={totalSyndics}
            icon={Landmark}
            colorClass="bg-sky-100 text-sky-600"
            active={serviceFilter === "serviceSyndic"}
            onClick={() => setServiceFilter((prev) => (prev === "serviceSyndic" ? null : "serviceSyndic"))}
          />
          <FilterKpiCard
            label="Total des agences"
            value={totalAgencies}
            icon={Home}
            colorClass="bg-emerald-100 text-emerald-600"
            active={serviceFilter === "geranceLocative"}
            onClick={() => setServiceFilter((prev) => (prev === "geranceLocative" ? null : "geranceLocative"))}
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <h2 className="text-lg">Répertoire des agences</h2>
        <p className="text-sm text-muted-foreground">Rechercher, filtrer et gérer toutes les agences.</p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher une agence…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        {isSuperAdmin && (
          <Button className="rounded-full" onClick={() => setCreating(true)}>
            <Plus />
            Ajouter une agence
          </Button>
        )}
      </div>

      <div className="flex flex-col">
        <div className="overflow-hidden rounded-xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] ring-1 ring-foreground/10">
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
            <TableBody className="bg-white">
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
                      {/* Agent = consultation seule (déjà visible dans les
                          colonnes ci-contre) : pas d'édition, cf. matrice de
                          droits BO. */}
                      {!isAgent && (
                        <Button variant="outline" size="sm" onClick={() => setEditingId(gerance.id)}>
                          <Pencil />
                          Modifier
                        </Button>
                      )}
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
      </div>

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
        open={editingId !== null}
        onOpenChange={(open) => !open && setEditingId(null)}
        title="Modifier l'agence"
        initial={editingGerance ? geranceToInput(editingGerance) : undefined}
        gerance={editingGerance}
        onSubmit={async (input) => {
          if (!editingGerance) return
          await updateGerance(editingGerance.id, input)
          toast.success("Agence mise à jour")
          setEditingId(null)
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
  gerance,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  initial?: GeranceInput
  // Objet Gerance PERSISTÉ (distinct de `initial`, la copie de travail
  // éditable) - fourni uniquement en édition, jamais en création (une
  // agence pas encore enregistrée n'a pas d'id à invitier dessus). Passé
  // jusqu'à ServiceSection pour le statut "compte actif" par agent.
  gerance?: Gerance | null
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
                  gerance={gerance}
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

const AGENT_UID_FIELD: Record<ServiceType, "serviceSyndicAgentUids" | "geranceLocativeAgentUids"> = {
  serviceSyndic: "serviceSyndicAgentUids",
  geranceLocative: "geranceLocativeAgentUids",
}

function ServiceSection({
  type,
  dept,
  gerance,
  onToggle,
  onChange,
}: {
  type: ServiceType
  dept?: AgencyDept
  gerance?: Gerance | null
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

  // "Le compte reste actif si on supprime la ligne sans révoquer d'abord" :
  // supprimer un agent/désactiver un service ne fait que retirer l'entrée
  // de services.<type>.agents (ou tout le service) au prochain
  // "Enregistrer" - ça ne touche ni serviceSyndicAgentUids/
  // geranceLocativeAgentUids, ni le compte Firebase Auth. Un agent/service
  // avec un compte actif doit donc être révoqué AVANT de pouvoir être
  // retiré, jamais implicitement par la suppression de sa ligne.
  const uidField = AGENT_UID_FIELD[type]
  function hasActiveAccount(uid: string | undefined): boolean {
    return !!uid && !!gerance?.[uidField]?.includes(uid)
  }
  const deptHasActiveAccount =
    hasActiveAccount(gerance?.services[type]?.uid) ||
    (gerance?.services[type]?.agents ?? []).some((a) => hasActiveAccount(a.uid))

  return (
    <div className="rounded-lg border p-3">
      <label
        className="flex items-center gap-2 text-sm font-medium"
        title={
          enabled && deptHasActiveAccount
            ? "Révoquez l'accès de tous les comptes de ce service avant de le désactiver"
            : undefined
        }
      >
        <input
          type="checkbox"
          className="size-4 rounded border-input"
          checked={enabled}
          disabled={enabled && deptHasActiveAccount}
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

          {/* Cas "adresse globale par service" (pas d'agent nommé) : le
              compte se rattache directement à cette adresse générique,
              même mécanique que pour un agent précis ci-dessous. */}
          {gerance && dept.mail && gerance.services[type]?.mail === dept.mail && (
            <AccountControl
              gerance={gerance}
              serviceType={type}
              mail={dept.mail}
              role="agence"
              persistedUid={gerance.services[type]?.uid}
              onLinkUid={(uid) => setDeptAccountUid(gerance, type, uid)}
            />
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Agents</Label>
              <Button type="button" variant="outline" size="sm" onClick={addAgent}>
                <Plus />
                Ajouter un agent
              </Button>
            </div>
            {dept.agents.map((agent, index) => {
              const persistedAgent = gerance?.services[type]?.agents.find((a) => a.mail === agent.mail)
              const agentHasActiveAccount = hasActiveAccount(persistedAgent?.uid)
              return (
              <div key={index} className="flex min-w-0 flex-col gap-2 rounded-md bg-muted/50 p-2">
                <div className="flex min-w-0 items-start gap-2">
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
                    disabled={agentHasActiveAccount}
                    title={agentHasActiveAccount ? "Révoquez l'accès de cet agent avant de le supprimer" : undefined}
                    onClick={() => removeAgent(index)}
                  >
                    <X />
                  </Button>
                </div>
                {gerance && agent.mail && (
                  persistedAgent ? (
                    <AccountControl
                      gerance={gerance}
                      serviceType={type}
                      mail={agent.mail}
                      role="agent"
                      persistedUid={persistedAgent.uid}
                      onLinkUid={(uid) => setAgentAccountUid(gerance, type, agent.mail!, uid)}
                    />
                  ) : (
                    <p className="px-1 text-xs text-muted-foreground">
                      Enregistrez d'abord l'agence pour pouvoir inviter cet agent.
                    </p>
                  )
                )}
              </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Statut/actions du compte BO lié à CETTE adresse mail (une adresse mail =
// une licence) - réutilisé pour un agent nommé (mail=agent.mail,
// persistedUid=agent.uid) ET pour l'adresse générique d'un service sans
// agent nommé (mail=dept.mail, persistedUid=dept.uid) : même mécanique,
// seule la façon de reporter l'uid une fois l'invitation acceptée diffère
// (onLinkUid). L'appelant est responsable de vérifier que `mail` est déjà
// PERSISTÉ (pas juste une saisie locale pas encore enregistrée) avant de
// monter ce composant.
function AccountControl({
  gerance,
  serviceType,
  mail,
  role,
  persistedUid,
  onLinkUid,
}: {
  gerance: Gerance
  serviceType: ServiceType
  mail: string
  // Déterminé par l'appelant selon le contexte (adresse générique du
  // service = "agence", agent nommé listé dessous = "agent") - jamais un
  // choix libre : à cette étape précise, le rôle est déjà connu.
  role: AgencyAccountRole
  persistedUid?: string
  onLinkUid: (uid: string) => Promise<void>
}) {
  const { isSuperAdmin } = useIsSuperAdmin()
  const [submitting, setSubmitting] = useState(false)

  if (!isSuperAdmin) return null

  const uidField = AGENT_UID_FIELD[serviceType]
  const isActive = !!persistedUid && !!gerance[uidField]?.includes(persistedUid)
  const isRevoked = !!persistedUid && !isActive

  async function handleInvite() {
    setSubmitting(true)
    try {
      const { uid } = await inviteAgencyAccount(gerance.id, serviceType, mail, role)
      await onLinkUid(uid)
      toast.success(`Invitation envoyée à ${mail}`)
    } catch (err) {
      toast.error("Échec de l'invitation : " + (err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRevoke() {
    if (!persistedUid) return
    setSubmitting(true)
    try {
      await revokeAgencyAccount(gerance.id, serviceType, persistedUid)
      toast.success("Accès révoqué")
    } catch (err) {
      toast.error("Échec de la révocation : " + (err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (isActive) {
    return (
      <div className="flex items-center gap-2 px-1">
        <Badge variant="outline" className="border-transparent bg-emerald-100 text-emerald-800">
          <Check />
          Compte actif
        </Badge>
        <Button type="button" variant="outline" size="sm" disabled={submitting} onClick={handleRevoke}>
          <ShieldOff />
          Révoquer l'accès
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-1">
      {isRevoked && (
        <Badge variant="outline" className="border-transparent bg-red-100 text-red-800">
          Accès révoqué
        </Badge>
      )}
      <Button type="button" variant="outline" size="sm" disabled={submitting} onClick={handleInvite}>
        <Mail />
        {isRevoked ? "Réinviter" : "Inviter"}
      </Button>
    </div>
  )
}
