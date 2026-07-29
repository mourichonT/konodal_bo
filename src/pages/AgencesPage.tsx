import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import {
  Briefcase,
  Check,
  CreditCard,
  Home,
  Landmark,
  Mail,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AddressAutocompleteInput } from "@/components/AddressAutocompleteInput"
import { ZipCodeCityInput } from "@/components/ZipCodeCityInput"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { PRIMARY_CTA_CLASS } from "@/lib/utils"
import {
  createGerance,
  inviteAgencyAccount,
  revokeAgencyAccount,
  setDeptAccountUid,
  subscribeToGerances,
  updateGerance,
  updateGeranceAddress,
  updateGeranceDeptContact,
  updateGeranceName,
  type AgencyAccountRole,
  type GeranceInput,
} from "@/lib/gerances"
import { resolveUsersByUids } from "@/lib/users"
import { subscribeToGeranceBilling } from "@/lib/billing"
import { searchCompanies, type CompanySearchResult } from "@/lib/companySearch"
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin"
import { useAccountRole } from "@/hooks/useAccountRole"
import { useAuth } from "@/lib/auth-context"
import { emptyAddress } from "@/types/residence"
import { billingStatusBadgeClass, billingStatusLabels, type GeranceBilling } from "@/types/billing"
import {
  AGENT_UID_FIELD,
  emptyAgencyDept,
  serviceTypeLabels,
  type AgencyDept,
  type Gerance,
  type ServiceType,
} from "@/types/gerance"
import type { KonodalUser } from "@/types/user"

const serviceTypes: ServiceType[] = ["serviceSyndic", "geranceLocative"]

// Nom affiché de l'agence : limite demandée explicitement, avec blocage à
// l'enregistrement (pas seulement une troncature silencieuse via maxLength,
// qui ne rattrape pas un nom déjà trop long chargé depuis Firestore avant
// l'ajout de cette limite).
const AGENCY_NAME_MAX_LENGTH = 20

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

  // Une Agence/un Agent n'a ni vue agrégée (KPI sur TOUTES les agences n'a
  // pas de sens pour un compte scopé à la sienne) ni répertoire à parcourir
  // (une seule fiche possible) : page dédiée, détaillée, sur le modèle des
  // pages détail du BO (ResidenceDetailPage, SinistreDetailPage...) plutôt
  // que la liste/table pensée pour Superadmin. Agence peut la modifier
  // (matrice de droits BO), Agent est en lecture seule.
  const isOwnAgencyView = isAgence || isAgent
  const ownGerance = isOwnAgencyView ? (gerances[0] ?? null) : null

  return (
    <div className="flex flex-col gap-6">
      {isOwnAgencyView ? (
        <OwnAgencyPage gerance={ownGerance} loading={loading} canEdit={isAgence} />
      ) : (
        <>
          <h1 className="text-[26px] font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">Agences</h1>

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

          <div className="flex flex-col gap-1">
            <h2 className="text-lg">Répertoire des agences</h2>
            <p className="text-sm text-muted-foreground">Rechercher, filtrer et gérer toutes les agences.</p>
          </div>

          <Card>
            <CardContent className="flex flex-wrap items-center gap-3">
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
                <Button className={`ml-auto ${PRIMARY_CTA_CLASS}`} onClick={() => setCreating(true)}>
                  <Plus />
                  Ajouter une agence
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col">
            <div className="overflow-hidden rounded-[24px] border border-[oklch(93%_0.005_100)] bg-white shadow-[0_1px_2px_oklch(20%_0_0/0.03),0_14px_34px_-22px_oklch(20%_0_0/0.12)]">
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
                          <Button variant="outline" size="sm" onClick={() => setEditingId(gerance.id)}>
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
        </>
      )}

      {/* Dialog d'édition partagé entre les deux vues (répertoire Superadmin
          et fiche unique Agence) - setEditingId est déclenché depuis l'une
          ou l'autre selon le rôle connecté. */}
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

// Résumé licences visible par le Superadmin dans la modale d'édition -
// jusqu'ici seule AgencyBillingCard (page dédiée de l'agence elle-même,
// /facturation) montrait le nombre de sièges, aucune visibilité admin sur ce
// que l'agence a réellement acheté vs. combien de comptes elle a déjà
// distribués. `assignedCount` réplique la déduplication serveur
// (_deduped_seat_uids, functions_python/main.py) : un même uid peut figurer
// dans les deux tableaux de service, compté une seule fois.
function BillingSummary({ gerance }: { gerance: Gerance }) {
  const [billing, setBilling] = useState<GeranceBilling>({ status: "none", seatCount: 0, currentPeriodEnd: null })

  useEffect(() => {
    return subscribeToGeranceBilling(gerance.id, setBilling, () => {})
  }, [gerance.id])

  const assignedCount = useMemo(
    () =>
      new Set([...(gerance.serviceSyndicAgentUids ?? []), ...(gerance.geranceLocativeAgentUids ?? [])]).size,
    [gerance]
  )
  const available = billing.seatCount - assignedCount

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[oklch(97%_0.006_155)] p-[14px_18px] text-[12.5px]">
      <Badge
        variant="outline"
        className={`gap-1.5 rounded-full font-bold ${billingStatusBadgeClass[billing.status]}`}
      >
        <span className="size-[6px] rounded-full bg-current" />
        {billingStatusLabels[billing.status]}
      </Badge>
      {billing.status === "none" ? (
        <span className="text-muted-foreground">Aucune licence achetée pour l'instant</span>
      ) : (
        <>
          <div aria-hidden className="h-4 w-px bg-[oklch(88%_0.01_150)]" />
          <span className="font-semibold text-muted-foreground">
            Licences achetées <strong className="font-bold text-foreground">{billing.seatCount}</strong>
          </span>
          <span className="font-semibold text-muted-foreground">
            Attribuées <strong className="font-bold text-foreground">{assignedCount}</strong>
          </span>
          <span className="font-semibold text-muted-foreground">
            Disponibles <strong className="font-bold text-foreground">{Math.max(available, 0)}</strong>
          </span>
        </>
      )}
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
  const [siret, setSiret] = useState(initial?.siret ?? "")
  const [responsableLegal, setResponsableLegal] = useState(initial?.responsableLegal ?? "")
  const [services, setServices] = useState<Partial<Record<ServiceType, AgencyDept>>>(
    initial?.services ?? {}
  )
  const [submitting, setSubmitting] = useState(false)

  // Recherche recherche-entreprises.api.gouv.fr (cf. companySearch.ts) - même
  // usage que ProfilePage (agence éditant sa propre fiche), mais ici pas de
  // gerance.id à l'écriture directe : une agence pas encore créée n'a pas de
  // document Firestore à mettre à jour, donc un résultat choisi ne fait que
  // préremplir les champs ci-dessous, revus/corrigibles avant "Enregistrer".
  const [companyQuery, setCompanyQuery] = useState("")
  const [companyResults, setCompanyResults] = useState<CompanySearchResult[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "")
      setStreet(initial?.address.street ?? emptyAddress.street)
      setZipCode(initial?.address.zipCode ?? emptyAddress.zipCode)
      setCity(initial?.address.city ?? emptyAddress.city)
      setSiret(initial?.siret ?? "")
      setResponsableLegal(initial?.responsableLegal ?? "")
      setServices(initial?.services ?? {})
      setCompanyQuery("")
      setCompanyResults([])
    }
  }, [open, initial])

  async function handleSearchCompany() {
    if (!companyQuery.trim()) return
    setSearching(true)
    try {
      const results = await searchCompanies(companyQuery)
      setCompanyResults(results)
      if (results.length === 0) toast.error("Aucun résultat pour cette recherche")
    } catch (err) {
      toast.error("Recherche impossible : " + (err as Error).message)
    } finally {
      setSearching(false)
    }
  }

  function handleApplyCompanyResult(result: CompanySearchResult) {
    setName(result.name)
    setStreet(result.address.street)
    setZipCode(result.address.zipCode)
    setCity(result.address.city)
    setResponsableLegal(result.responsableLegal)
    setSiret(result.siret)
    setCompanyResults([])
    setCompanyQuery("")
    toast.success("Informations reprises depuis la recherche - vérifiez avant d'enregistrer")
  }

  function toggleService(type: ServiceType, enabled: boolean) {
    setServices((prev) => {
      const next = { ...prev }
      if (enabled) {
        next[type] = next[type] ?? { ...emptyAgencyDept }
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
        siret,
        responsableLegal,
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
          <DialogHeader className="border-b border-[oklch(95%_0.003_100)] pb-4">
            <span className="text-[11.5px] font-bold tracking-wide text-primary uppercase">Agence</span>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-4 pl-[5px]">
            {gerance && <BillingSummary gerance={gerance} />}

            <div className="flex flex-col gap-2.5 rounded-[18px] border-[1.5px] border-dashed border-[oklch(78%_0.07_155)] bg-[oklch(98%_0.008_155)] p-[18px_20px]">
              <Label htmlFor="ger-company-search" className="font-bold">
                Rechercher l'entreprise{" "}
                <span className="font-medium text-muted-foreground">(SIREN, SIRET ou nom)</span>
              </Label>
              <div className="flex flex-wrap gap-2.5">
                <Input
                  id="ger-company-search"
                  placeholder="Rechercher (nom, SIRET, SIREN)…"
                  className="max-w-xs"
                  value={companyQuery}
                  onChange={(e) => setCompanyQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearchCompany())}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSearchCompany}
                  disabled={searching}
                  className="border-0 bg-[oklch(24%_0.03_155)] text-white hover:bg-[oklch(30%_0.04_155)]"
                >
                  <Search />
                  Rechercher
                </Button>
              </div>
              {companyResults.length > 0 && (
                <div className="flex flex-col gap-2">
                  {companyResults.map((result) => (
                    <div
                      key={result.siret || result.siren}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 p-2 text-sm"
                    >
                      <div>
                        <span className="font-medium">{result.name}</span>
                        <span className="text-muted-foreground">
                          {" — "}
                          {[result.address.street, [result.address.zipCode, result.address.city].join(" ")]
                            .filter(Boolean)
                            .join(" — ") || "—"}
                          {result.responsableLegal ? ` · ${result.responsableLegal}` : ""}
                        </span>
                      </div>
                      <Button type="button" size="sm" onClick={() => handleApplyCompanyResult(result)}>
                        Utiliser ces informations
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <p className="m-0 text-xs leading-relaxed text-[oklch(48%_0.06_155)]">
                Préremplit le nom, l'adresse, le SIRET et le responsable légal ci-dessous - à vérifier avant
                d'enregistrer, ou à saisir/corriger manuellement sans passer par la recherche.
              </p>
            </div>

            <div className="mt-[20px] flex flex-col gap-1.5">
              <Label htmlFor="ger-name">Nom de l'agence</Label>
              <Input id="ger-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ger-street">Adresse</Label>
              <AddressAutocompleteInput
                id="ger-street"
                required
                value={street}
                onChange={setStreet}
                onSelect={(a) => {
                  setStreet(a.street)
                  setZipCode(a.zipCode)
                  setCity(a.city)
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ger-zip">Code postal</Label>
                <ZipCodeCityInput
                  id="ger-zip"
                  required
                  value={zipCode}
                  onChange={setZipCode}
                  onCityResolved={setCity}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ger-city">Ville</Label>
                <Input id="ger-city" required value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ger-siret">SIRET / SIREN</Label>
                <Input
                  id="ger-siret"
                  placeholder="123 456 789 00012"
                  value={siret}
                  onChange={(e) => setSiret(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ger-responsable">Responsable légal</Label>
                <Input
                  id="ger-responsable"
                  value={responsableLegal}
                  onChange={(e) => setResponsableLegal(e.target.value)}
                />
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={submitting} className={PRIMARY_CTA_CLASS}>
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

  // Désactiver tout un service alors qu'il reste des comptes actifs dessus
  // (compte générique ou agents nommés, tous deux dans ce même tableau
  // désormais) le couperait sans passer par revoke_agency_account -
  // il faut d'abord tous les révoquer.
  const uidField = AGENT_UID_FIELD[type]
  const deptHasActiveAccount = (gerance?.[uidField]?.length ?? 0) > 0

  return (
    <div className="rounded-[18px] border border-[oklch(93%_0.005_100)] p-[18px_20px]">
      <label
        className="flex items-center gap-2.5 text-[13.5px] font-bold text-[oklch(24%_0.01_150)]"
        title={
          enabled && deptHasActiveAccount
            ? "Révoquez l'accès de tous les comptes de ce service avant de le désactiver"
            : undefined
        }
      >
        <input
          type="checkbox"
          className="size-[17px] rounded border-input accent-primary"
          checked={enabled}
          disabled={enabled && deptHasActiveAccount}
          onChange={(e) => onToggle(e.target.checked)}
        />
        {serviceTypeLabels[type]}
      </label>

      {dept && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${type}-mail`}>Email du service</Label>
              <Input
                id={`${type}-mail`}
                type="email"
                value={dept.mail}
                // Verrouillé dès qu'une adresse est déjà persistée (rattachée
                // à une licence, cf. AccountControl ci-dessous) - modifiable
                // uniquement tant que le service vient d'être activé et n'a
                // encore jamais été enregistré avec un email.
                disabled={!!gerance?.services[type]?.mail}
                title={gerance?.services[type]?.mail ? "Rattaché à une licence, non modifiable" : undefined}
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

          {gerance ? (
            <NamedAgentsManager gerance={gerance} type={type} />
          ) : (
            <p className="text-xs text-muted-foreground">
              Enregistrez d'abord l'agence pour pouvoir inviter des agents.
            </p>
          )}
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
  // Une Agence gère ses propres agents (inviter/révoquer) sans passer par un
  // superAdmin - Agent reste en lecture seule sur cette action (cf. matrice
  // de droits). Portée déjà garantie côté client : `gerances` (AgencesPage)
  // ne contient QUE la gérance de l'agence connectée, donc ce composant ne
  // peut jamais monter sur la fiche d'une autre agence. Côté serveur,
  // _require_superadmin_or_own_agence revérifie la même appartenance.
  const { isAgence } = useAccountRole()
  const { user } = useAuth()
  const [submitting, setSubmitting] = useState(false)

  if (!isSuperAdmin && !isAgence) return null

  const uidField = AGENT_UID_FIELD[serviceType]
  const isActive = !!persistedUid && !!gerance[uidField]?.includes(persistedUid)
  const isRevoked = !!persistedUid && !isActive
  // Une Agence gérant sa propre fiche peut tomber sur SON PROPRE compte
  // (adresse générique du service, ou elle-même listée comme agent) - se
  // révoquer soi-même couperait immédiatement l'accès en cours d'usage,
  // sans façon de se réinviter derrière (il faudrait déjà être déconnecté
  // pour redemander l'accès à un superAdmin). Bouton masqué dans ce cas
  // précis, pas juste désactivé côté serveur : un superAdmin, lui, n'est
  // jamais concerné (il ne peut pas être le compte agence/agent affiché ici).
  const isSelf = !!persistedUid && persistedUid === user?.uid

  async function handleInvite() {
    setSubmitting(true)
    try {
      const result = await inviteAgencyAccount(gerance.id, serviceType, mail, role)
      if (result.pending) {
        // Rien à lier : aucun compte n'a été créé (pas d'abonnement actif),
        // seul un email commercial est parti - lier un uid inexistant
        // afficherait à tort "Compte actif" avant tout paiement.
        toast.success(`Email envoyé à ${mail} — l'accès sera activé après paiement des licences`)
      } else {
        await onLinkUid(result.uid)
        toast.success(`Invitation envoyée à ${mail}`)
      }
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
        {isSelf ? (
          <span className="text-xs text-muted-foreground">C'est votre compte</span>
        ) : (
          <Button type="button" variant="outline" size="sm" disabled={submitting} onClick={handleRevoke}>
            <ShieldOff />
            Révoquer l'accès
          </Button>
        )}
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

// Liste des agents nommés d'un service - un agent n'existe QUE via
// serviceSyndicAgentUids/geranceLocativeAgentUids (compte déjà invité),
// résolu en fiche complète via resolveUsersByUids. Partagé entre
// ServiceSection (dialog Superadmin) et AgencyServiceCard (fiche Agence) :
// même mécanique, seul le contexte d'appel diffère. Éditable par
// superAdmin/agence, en lecture seule pour agent (même garde que
// AccountControl).
function NamedAgentsManager({ gerance, type }: { gerance: Gerance; type: ServiceType }) {
  const { isSuperAdmin } = useIsSuperAdmin()
  const { isAgence } = useAccountRole()
  const { user } = useAuth()
  const canEdit = isSuperAdmin || isAgence

  const deptUid = gerance.services[type]?.uid
  const agentUids = useMemo(
    () => (gerance[AGENT_UID_FIELD[type]] ?? []).filter((uid) => uid !== deptUid),
    [gerance, type, deptUid]
  )
  const [profiles, setProfiles] = useState<KonodalUser[]>([])
  const [loadingProfiles, setLoadingProfiles] = useState(false)
  const [newAgentEmail, setNewAgentEmail] = useState("")
  const [inviting, setInviting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (agentUids.length === 0) {
      setProfiles([])
      return
    }
    let cancelled = false
    setLoadingProfiles(true)
    resolveUsersByUids(agentUids)
      .then((users) => {
        if (!cancelled) setProfiles(users)
      })
      .finally(() => {
        if (!cancelled) setLoadingProfiles(false)
      })
    return () => {
      cancelled = true
    }
  }, [agentUids])

  async function handleInvite() {
    const email = newAgentEmail.trim()
    if (!email) return
    setInviting(true)
    try {
      const result = await inviteAgencyAccount(gerance.id, type, email, "agent")
      setNewAgentEmail("")
      setConfirmOpen(false)
      toast.success(
        result.pending
          ? `Email envoyé à ${email} — l'accès sera activé après paiement des licences`
          : `Invitation envoyée à ${email}`
      )
    } catch (err) {
      toast.error("Échec de l'invitation : " + (err as Error).message)
    } finally {
      setInviting(false)
    }
  }

  async function handleRevoke(uid: string) {
    try {
      await revokeAgencyAccount(gerance.id, type, uid)
      toast.success("Accès révoqué")
    } catch (err) {
      toast.error("Échec de la révocation : " + (err as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <Label className="font-bold">Agents</Label>
      {loadingProfiles ? (
        <p className="rounded-xl bg-[oklch(97%_0.005_100)] p-3 text-[12.5px] font-semibold text-muted-foreground">
          Chargement…
        </p>
      ) : profiles.length === 0 ? (
        <p className="rounded-xl bg-[oklch(97%_0.005_100)] p-3 text-[12.5px] font-semibold text-muted-foreground">
          Aucun agent pour ce service.
        </p>
      ) : (
        profiles.map((profile) => {
          const isSelf = profile.uid === user?.uid
          return (
            <div
              key={profile.uid}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 p-2.5"
            >
              <div className="text-sm">
                <span className="font-medium">
                  {`${profile.name} ${profile.surname}`.trim() || profile.email}
                </span>
                <span className="text-muted-foreground">
                  {" — "}
                  {[profile.email, profile.phone].filter(Boolean).join(" · ") || "—"}
                </span>
              </div>
              {canEdit &&
                (isSelf ? (
                  <span className="text-xs text-muted-foreground">C'est votre compte</span>
                ) : (
                  <Button type="button" variant="outline" size="sm" onClick={() => handleRevoke(profile.uid)}>
                    <ShieldOff />
                    Révoquer l'accès
                  </Button>
                ))}
            </div>
          )
        })
      )}
      {canEdit && (
        <div className="flex gap-2.5">
          <Input
            placeholder="Email de l'agent à inviter"
            type="email"
            value={newAgentEmail}
            onChange={(e) => setNewAgentEmail(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={inviting || !newAgentEmail.trim()}
          >
            <Mail />
            Inviter
          </Button>
        </div>
      )}

      {/* Un nouvel agent (uid pas déjà compté sur l'autre service de cette
          gérance) ajoute immédiatement un siège facturé - prévenir avant
          l'action plutôt qu'après, cf. demande explicite. */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmer l'invitation</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Si <strong>{newAgentEmail.trim()}</strong> n'a pas déjà accès à konodal, cette
            invitation ajoutera un nouveau siège facturé à votre abonnement, au prorata et dès
            maintenant.
          </DialogDescription>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={inviting}>
              Annuler
            </Button>
            <Button type="button" onClick={handleInvite} disabled={inviting} className={PRIMARY_CTA_CLASS}>
              <Mail />
              Confirmer l'invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Page détaillée de l'agence à laquelle un compte Agence/Agent est
// rattaché - même gabarit (titre + Cards empilées) que les autres pages
// détail du BO (ResidenceDetailPage, SinistreDetailPage,
// EvenementDetailPage), plutôt que la liste/répertoire pensée pour
// Superadmin qui n'a pas de sens pour un compte scopé à une seule fiche.
// canEdit=false (Agent) = pure consultation ; canEdit=true (Agence) = champs
// directement modifiables sur la page (pas de bouton "Modifier"/dialog -
// demande explicite : les infos doivent être visibles ET éditables tout de
// suite, y compris inviter/révoquer/retirer un agent).
function OwnAgencyPage({
  gerance,
  loading,
  canEdit,
}: {
  gerance: Gerance | null
  loading: boolean
  canEdit: boolean
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3.5">
        <div className="flex size-[46px] shrink-0 items-center justify-center rounded-[13px] bg-[oklch(93%_0.05_150)]">
          <Home className="size-[21px] text-[oklch(38%_0.09_155)]" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">
          {gerance ? gerance.name : loading ? "…" : "Agence introuvable"}
        </h1>
      </div>

      {!loading && !gerance && (
        <p className="text-muted-foreground">
          Aucune agence n'est rattachée à votre compte pour l'instant.
        </p>
      )}

      {gerance && (
        <>
          <AgencyInfoCard gerance={gerance} canEdit={canEdit} />
          <AgencyBillingCard gerance={gerance} canEdit={canEdit} />
          {serviceTypes
            .filter((type) => gerance.services[type])
            .map((type) => (
              <AgencyServiceCard key={type} gerance={gerance} type={type} canEdit={canEdit} />
            ))}
        </>
      )}
    </div>
  )
}

function AgencyInfoCard({ gerance, canEdit }: { gerance: Gerance; canEdit: boolean }) {
  const [name, setName] = useState(gerance.name)
  const [street, setStreet] = useState(gerance.address.street)
  const [zipCode, setZipCode] = useState(gerance.address.zipCode)
  const [city, setCity] = useState(gerance.address.city)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(gerance.name)
    setStreet(gerance.address.street)
    setZipCode(gerance.address.zipCode)
    setCity(gerance.address.city)
  }, [gerance.id, gerance.name, gerance.address.street, gerance.address.zipCode, gerance.address.city])

  async function handleSave() {
    if (name.trim().length > AGENCY_NAME_MAX_LENGTH) {
      toast.error(`Le nom de l'agence ne peut pas dépasser ${AGENCY_NAME_MAX_LENGTH} caractères`)
      return
    }
    setSaving(true)
    try {
      await Promise.all([
        updateGeranceName(gerance.id, name),
        updateGeranceAddress(gerance.id, { ...emptyAddress, street, zipCode, city }),
      ])
      toast.success("Informations mises à jour")
    } catch (err) {
      toast.error("Échec de l'enregistrement : " + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle className="text-base">Informations</CardTitle>
      </CardHeader>
      <CardContent>
        {canEdit ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agency-name">Nom de l'agence</Label>
              <Input
                id="agency-name"
                required
                maxLength={AGENCY_NAME_MAX_LENGTH}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {name.length >= AGENCY_NAME_MAX_LENGTH && (
                <p className="text-xs text-red-600">
                  Limite de {AGENCY_NAME_MAX_LENGTH} caractères atteinte
                </p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="agency-street">Adresse</Label>
                <AddressAutocompleteInput
                  id="agency-street"
                  value={street}
                  onChange={setStreet}
                  onSelect={(a) => {
                    setStreet(a.street)
                    setZipCode(a.zipCode)
                    setCity(a.city)
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="agency-zip">Code postal</Label>
                <ZipCodeCityInput
                  id="agency-zip"
                  value={zipCode}
                  onChange={setZipCode}
                  onCityResolved={setCity}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="agency-city">Ville</Label>
                <Input id="agency-city" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button className={`w-fit ${PRIMARY_CTA_CLASS}`} size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
                <Save />
                Enregistrer
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1 text-sm">
            <div>
              <span className="text-muted-foreground">Nom : </span>
              {name || "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Adresse : </span>
              {[street, [zipCode, city].join(" ")].filter(Boolean).join(" — ") || "—"}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Simple rappel de l'offre souscrite (statut + nombre de sièges actifs) -
// toute la gestion (souscrire, changer de carte, factures) vit désormais
// sur la page dédiée /facturation (BillingPage.tsx, menu Profil), pas ici.
// Page /facturation réservée à l'agence (jamais un Agent, cf. Sidebar.tsx) :
// le bouton d'accès n'est donc affiché que pour canEdit=true, un Agent ne
// voit que le statut/nombre de sièges en lecture seule sur cette card.
function AgencyBillingCard({ gerance, canEdit }: { gerance: Gerance; canEdit: boolean }) {
  const [billing, setBilling] = useState<GeranceBilling>({ status: "none", seatCount: 0, currentPeriodEnd: null })

  useEffect(() => {
    return subscribeToGeranceBilling(
      gerance.id,
      setBilling,
      (error) => toast.error("Impossible de charger l'abonnement : " + error.message)
    )
  }, [gerance.id])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Abonnement</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className={billingStatusBadgeClass[billing.status]}>
            {billingStatusLabels[billing.status]}
          </Badge>
          {billing.status !== "none" && (
            <span className="text-sm text-muted-foreground">
              {billing.seatCount} siège{billing.seatCount > 1 ? "s" : ""} actif{billing.seatCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" render={<Link to="/facturation" />}>
            <CreditCard />
            Voir la facturation
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function AgencyServiceCard({
  gerance,
  type,
  canEdit,
}: {
  gerance: Gerance
  type: ServiceType
  canEdit: boolean
}) {
  const dept = gerance.services[type]
  const [phone, setPhone] = useState(dept?.phone ?? "")
  const [savingContact, setSavingContact] = useState(false)

  useEffect(() => {
    setPhone(dept?.phone ?? "")
  }, [gerance.id, type, dept?.phone])

  if (!dept) return null
  const currentDept = dept

  // Email du service jamais modifiable ici (contrairement au téléphone) :
  // c'est l'identifiant de la licence (une adresse mail = un compte
  // agence/agent invité via invite_agency_account) - le changer désynchro-
  // niserait l'email affiché du compte Firebase Auth réellement rattaché
  // (dept.uid), qui continuerait de pointer sur l'ancienne adresse.
  async function handleSaveContact() {
    setSavingContact(true)
    try {
      await updateGeranceDeptContact(gerance.id, type, { mail: currentDept.mail, phone })
      toast.success("Service mis à jour")
    } catch (err) {
      toast.error("Échec de l'enregistrement : " + (err as Error).message)
    } finally {
      setSavingContact(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{serviceTypeLabels[type]}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {canEdit ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="grid flex-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${type}-svc-mail`}>Email du service</Label>
                <Input
                  id={`${type}-svc-mail`}
                  value={dept.mail}
                  disabled
                  title="Rattaché à une licence, non modifiable"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${type}-svc-phone`}>Téléphone</Label>
                <Input id={`${type}-svc-phone`} value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <Button size="sm" onClick={handleSaveContact} disabled={savingContact} className={PRIMARY_CTA_CLASS}>
              <Save />
              Enregistrer
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Email du service : </span>
              {dept.mail || "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Téléphone : </span>
              {dept.phone || "—"}
            </div>
          </div>
        )}

        {canEdit && dept.mail && (
          <AccountControl
            gerance={gerance}
            serviceType={type}
            mail={dept.mail}
            role="agence"
            persistedUid={dept.uid}
            onLinkUid={(uid) => setDeptAccountUid(gerance, type, uid)}
          />
        )}

        <div className="border-t pt-4">
          <NamedAgentsManager gerance={gerance} type={type} />
        </div>
      </CardContent>
    </Card>
  )
}
