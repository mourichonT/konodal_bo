import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft, ChevronDown, Eye, GripVertical, Home, Info, MoreVertical, Percent, Plus, Search, Settings2, ShieldOff, Trash2, Upload, UserPlus, Vote as VoteIcon, X } from "lucide-react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AddressAutocompleteInput } from "@/components/AddressAutocompleteInput"
import { ZipCodeCityInput } from "@/components/ZipCodeCityInput"
import { SearchableSelect } from "@/components/SearchableSelect"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  setCsMember,
  subscribeToResidence,
  updateResidence,
  updateResidenceGeranceRef,
  type ResidenceInput,
} from "@/lib/residences"
import {
  createStructure,
  deleteStructure,
  reorderStructures,
  subscribeToStructures,
  updateStructure,
  type StructureInput,
} from "@/lib/structures"
import {
  createLot,
  deleteLot,
  importLots,
  linkLot,
  reorderLots,
  subscribeToLots,
  updateLot,
  type LotInput,
} from "@/lib/lots"
import {
  createClefCharge,
  deleteClefCharge,
  subscribeToClesCharge,
  updateClefChargeNom,
} from "@/lib/clesCharge"
import { LotImportDialog } from "@/components/LotImportDialog"
import { LotClefsChargeDialog } from "@/components/LotClefsChargeDialog"
import { VoteFormDialog } from "@/components/VoteFormDialog"
import { saveResidenceAccessPoint, setStructureAccessPoint, subscribeToResidenceAccessPoint } from "@/lib/accessPoints"
import { AccessPointType, accessPointTypeLabels, type AccessPoint, type AccessPointTypeValue } from "@/types/accessPoint"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { subscribeToGerances } from "@/lib/gerances"
import { resolveUsersByUids } from "@/lib/users"
import { deleteVote, subscribeToVotes } from "@/lib/votes"
import { useAuth } from "@/lib/auth-context"
import { emptyAddress, type Residence } from "@/types/residence"
import { structureElementOptions, structureTypeOptions, type StructureResidence } from "@/types/structure"
import { defaultIsLinkableForType, typeLotOptions, type Lot } from "@/types/lot"
import { totalTantiemes, type ClefCharge } from "@/types/clefCharge"
import { AGENT_UID_FIELD, serviceTypeLabels, type Gerance, type ServiceType } from "@/types/gerance"
import type { KonodalUser } from "@/types/user"
import { VoteType, isSessionFinished, isVoteClosed, isVoteStarted, isVotePaused, type Vote } from "@/types/vote"
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin"
import { cn, PRIMARY_CTA_CLASS } from "@/lib/utils"

// Onglets de la page résidence - regroupe les sections par usage (fiche +
// CS d'un côté, réglages structurels de l'autre, lots et votes chacun dans
// leur propre onglet) plutôt qu'un long scroll unique, cf. retour
// utilisateur. Switch en state local (pas de sous-routes/Outlet comme
// SinistresPage) : tout vit déjà dans ce même composant, pas besoin d'URLs
// dédiées par onglet.
const residenceTabs = [
  { key: "information", label: "Information", icon: Info },
  { key: "configuration", label: "Configuration", icon: Settings2 },
  { key: "lots", label: "Configuration des lots", icon: Home },
  { key: "votes", label: "Votes & assemblées générales", icon: VoteIcon },
] as const
type ResidenceTabKey = (typeof residenceTabs)[number]["key"]

export default function ResidenceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [residence, setResidence] = useState<Residence | null>(null)
  const [loading, setLoading] = useState(true)
  const [structures, setStructures] = useState<StructureResidence[]>([])
  const [activeTab, setActiveTab] = useState<ResidenceTabKey>("information")

  useEffect(() => {
    if (!id) return
    setLoading(true)
    return subscribeToResidence(
      id,
      (data) => {
        setResidence(data)
        setLoading(false)
      },
      (error) => {
        toast.error("Impossible de charger la résidence : " + error.message)
        setLoading(false)
      }
    )
  }, [id])

  useEffect(() => {
    if (!id) return
    return subscribeToStructures(
      id,
      (data) => setStructures(data),
      (error) => toast.error("Impossible de charger les bâtiments : " + error.message)
    )
  }, [id])

  if (!id) return null

  return (
    <div className="-mt-[20px] flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link
          to="/residences"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Résidences
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">{residence?.name || (loading ? "…" : "Résidence introuvable")}</h1>
      </div>

      {!loading && !residence && (
        <p className="text-muted-foreground">Cette résidence n'existe pas ou a été supprimée.</p>
      )}

      {residence && (
        <>
          <div className="flex w-full items-center gap-1 rounded-2xl bg-[oklch(93%_0.005_100)] p-1.5">
            {residenceTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-[13.5px] font-semibold transition-colors",
                  activeTab === tab.key
                    ? "bg-[oklch(45%_0.1_155)] font-bold text-white shadow-[0_6px_16px_-6px_oklch(38%_0.08_155/0.5)]"
                    : "text-[oklch(45%_0.01_150)] hover:bg-[oklch(98%_0.003_100)]"
                )}
              >
                <tab.icon className="size-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "information" && (
            <div className="flex flex-col gap-5">
              <InfoSection residence={residence} />
              <CsMembersSection residenceId={id} residence={residence} />
            </div>
          )}

          {activeTab === "configuration" && (
            <div className="flex flex-col gap-5">
              <StructuresSection residenceId={id} structures={structures} />
              <SecurityAccessSection residenceId={id} structures={structures} />
              <ClesChargeSection residenceId={id} />
            </div>
          )}

          {activeTab === "lots" && <LotsSection residenceId={id} structures={structures} />}

          {activeTab === "votes" && <VotesSection residenceId={id} />}
        </>
      )}
    </div>
  )
}

// Membres du Conseil Syndical (residences/{id}.csmembers) - éligibles
// uniquement parmi les propriétaires déjà déclarés sur un lot de CETTE
// résidence (idProprietaire), pas les locataires (décision explicite de
// cadrage) : un CS est élu parmi les copropriétaires du même immeuble.
// Superadmin ET agence/agent peuvent inviter/retirer (aucun gate de rôle ici
// - firestore.rules l'autorise déjà sans restriction de champ sur
// residences/{id}.update, cf. lib/residences.ts:setCsMember).
function CsMembersSection({ residenceId, residence }: { residenceId: string; residence: Residence }) {
  const [lots, setLots] = useState<Lot[]>([])
  const [owners, setOwners] = useState<KonodalUser[]>([])
  const [loadingOwners, setLoadingOwners] = useState(false)
  const [pendingUid, setPendingUid] = useState<string | null>(null)
  // Filtre la liste "Propriétaires éligibles" (nom ou email) - peut compter
  // plusieurs centaines d'entrées sur une grosse résidence, cf. retour
  // utilisateur.
  const [eligibleSearch, setEligibleSearch] = useState("")

  useEffect(() => {
    return subscribeToLots(
      residenceId,
      setLots,
      (error) => toast.error("Impossible de charger les lots : " + error.message)
    )
  }, [residenceId])

  const ownerUids = useMemo(() => {
    const ids = new Set<string>()
    for (const lot of lots) for (const uid of lot.idProprietaire) ids.add(uid)
    return [...ids]
  }, [lots])

  useEffect(() => {
    if (ownerUids.length === 0) {
      setOwners([])
      return
    }
    let cancelled = false
    setLoadingOwners(true)
    resolveUsersByUids(ownerUids)
      .then((users) => {
        if (!cancelled) setOwners(users)
      })
      .finally(() => {
        if (!cancelled) setLoadingOwners(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerUids.join(",")])

  async function handleToggle(user: KonodalUser, member: boolean) {
    setPendingUid(user.uid)
    try {
      const { emailSent } = await setCsMember(
        residenceId,
        user.uid,
        member,
        user.email,
        residence.name
      )
      if (member) {
        toast.success(
          emailSent
            ? "Invité au Conseil Syndical, email envoyé"
            : "Invité au Conseil Syndical, mais l'email n'a pas pu être envoyé"
        )
      } else {
        toast.success("Retiré du Conseil Syndical")
      }
    } catch (err) {
      toast.error("Échec de la mise à jour : " + (err as Error).message)
    } finally {
      setPendingUid(null)
    }
  }

  const csMemberUids = residence.csmembers ?? []
  const members = owners.filter((u) => csMemberUids.includes(u.uid))
  const eligible = owners.filter((u) => !csMemberUids.includes(u.uid))
  const normalizedEligibleSearch = eligibleSearch.trim().toLowerCase()
  const filteredEligible = normalizedEligibleSearch
    ? eligible.filter((u) =>
        `${u.name} ${u.surname} ${u.email}`.toLowerCase().includes(normalizedEligibleSearch)
      )
    : eligible

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Conseil Syndical</CardTitle>
        <CardDescription>
          Propriétaires d'un lot de cette résidence invités à devenir membre du CS.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label className="font-bold">Membres actuels</Label>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun membre pour l'instant.</p>
          ) : (
            members.map((u) => (
              <div
                key={u.uid}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 p-2.5"
              >
                <div className="text-sm">
                  <span className="font-medium">{`${u.name} ${u.surname}`.trim() || u.email}</span>
                  <span className="text-muted-foreground"> — {u.email}</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pendingUid === u.uid}
                  onClick={() => handleToggle(u, false)}
                >
                  <ShieldOff />
                  Retirer
                </Button>
              </div>
            ))
          )}
        </div>

        {eligible.length > 0 && (
          <div className="flex flex-col gap-2 border-t pt-4">
            <Label className="font-bold">Propriétaires éligibles ({eligible.length})</Label>
            <div className="relative">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom ou email…"
                value={eligibleSearch}
                onChange={(e) => setEligibleSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
              {filteredEligible.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun propriétaire ne correspond à la recherche.</p>
              ) : (
                filteredEligible.map((u) => (
                  <div
                    key={u.uid}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 p-2.5"
                  >
                    <div className="text-sm">
                      <span className="font-medium">{`${u.name} ${u.surname}`.trim() || u.email}</span>
                      <span className="text-muted-foreground"> — {u.email}</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pendingUid === u.uid}
                      onClick={() => handleToggle(u, true)}
                    >
                      <UserPlus />
                      Inviter au CS
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {!loadingOwners && owners.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aucun propriétaire déclaré sur un lot de cette résidence pour l'instant.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function InfoSection({ residence }: { residence: Residence }) {
  const [name, setName] = useState(residence.name)
  const [street, setStreet] = useState(residence.address.street)
  const [zipCode, setZipCode] = useState(residence.address.zipCode)
  const [city, setCity] = useState(residence.address.city)
  const [mailContact, setMailContact] = useState(residence.mail_contact ?? "")
  const [saving, setSaving] = useState(false)
  const { isSuperAdmin } = useIsSuperAdmin()

  // Gérance qui gère cette résidence (geranceRef) - condition nécessaire
  // pour qu'un compte agence/agent RBAC voie quoi que ce soit sur cette
  // résidence (isProfessionnelResidence côté firestore.rules). Réservé
  // superAdmin : un CS member ou un professionnel déjà rattaché pourrait
  // sinon se réassigner lui-même une autre résidence via ce champ (la règle
  // Firestore actuelle ne restreint pas ce champ précis sur residences.update).
  const [gerances, setGerances] = useState<Gerance[]>([])
  const [geranceId, setGeranceId] = useState(residence.geranceRef?.geranceId ?? "")
  const [serviceType, setServiceType] = useState<ServiceType | "">(residence.geranceRef?.serviceType ?? "")
  const [agentUid, setAgentUid] = useState(residence.geranceRef?.agentUid ?? "")

  useEffect(() => {
    setName(residence.name)
    setStreet(residence.address.street)
    setZipCode(residence.address.zipCode)
    setCity(residence.address.city)
    setMailContact(residence.mail_contact ?? "")
    setGeranceId(residence.geranceRef?.geranceId ?? "")
    setServiceType(residence.geranceRef?.serviceType ?? "")
    setAgentUid(residence.geranceRef?.agentUid ?? "")
  }, [residence.id])

  useEffect(() => {
    if (!isSuperAdmin) return
    return subscribeToGerances(setGerances, () => {
      toast.error("Impossible de charger les agences")
    })
  }, [isSuperAdmin])

  const selectedGerance = gerances.find((g) => g.id === geranceId)
  const availableServiceTypes = (Object.keys(selectedGerance?.services ?? {}) as ServiceType[])

  // Agents nommés = comptes déjà invités sur ce service (serviceSyndicAgentUids/
  // geranceLocativeAgentUids), résolus depuis users/{uid} - le compte
  // générique du service (dept.uid) est exclu, il a déjà sa propre option
  // "Service (générique)" ci-dessous.
  const [availableAgents, setAvailableAgents] = useState<KonodalUser[]>([])
  useEffect(() => {
    if (!serviceType || !selectedGerance) {
      setAvailableAgents([])
      return
    }
    const dept = selectedGerance.services[serviceType]
    const uids = (selectedGerance[AGENT_UID_FIELD[serviceType]] ?? []).filter((uid) => uid !== dept?.uid)
    if (uids.length === 0) {
      setAvailableAgents([])
      return
    }
    let cancelled = false
    resolveUsersByUids(uids).then((users) => {
      if (!cancelled) setAvailableAgents(users)
    })
    return () => {
      cancelled = true
    }
  }, [serviceType, selectedGerance])

  async function handleSave() {
    setSaving(true)
    try {
      const input: ResidenceInput = {
        name,
        address: { ...emptyAddress, street, zipCode, city },
        mail_contact: mailContact,
      }
      await updateResidence(residence.id, input)
      if (isSuperAdmin) {
        await updateResidenceGeranceRef(
          residence.id,
          geranceId && serviceType
            ? { geranceId, serviceType, ...(agentUid ? { agentUid } : {}) }
            : null
        )
      }
      toast.success("Résidence mise à jour")
    } catch (err) {
      toast.error("Échec de l'enregistrement : " + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informations</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="info-name">Nom</Label>
            <Input id="info-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="info-mail">Email de contact</Label>
            <Input
              id="info-mail"
              type="email"
              value={mailContact}
              onChange={(e) => setMailContact(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="info-street">Adresse</Label>
            <AddressAutocompleteInput
              id="info-street"
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
            <Label htmlFor="info-zip">Code postal</Label>
            <ZipCodeCityInput
              id="info-zip"
              value={zipCode}
              onChange={setZipCode}
              onCityResolved={setCity}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="info-city">Ville</Label>
            <Input id="info-city" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
        </div>

        {isSuperAdmin && (
          <div className="flex flex-col gap-3 border-t pt-4">
            <Label>Gérance rattachée</Label>
            <p className="text-xs text-muted-foreground">
              Détermine quel compte agence/agent (RBAC) a accès à cette résidence depuis le backoffice.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <SearchableSelect
                value={geranceId}
                onChange={(v) => {
                  setGeranceId(v)
                  setServiceType("")
                  setAgentUid("")
                }}
                emptyLabel="Aucune gérance"
                groups={[{ options: gerances.map((g) => ({ value: g.id, label: g.name })) }]}
              />
              <SearchableSelect
                value={serviceType}
                disabled={!geranceId}
                onChange={(v) => {
                  setServiceType(v as ServiceType)
                  setAgentUid("")
                }}
                emptyLabel="Choisir un service"
                groups={[
                  {
                    options: availableServiceTypes.map((type) => ({
                      value: type,
                      label: serviceTypeLabels[type],
                    })),
                  },
                ]}
              />
              <SearchableSelect
                value={agentUid}
                disabled={!serviceType}
                onChange={setAgentUid}
                emptyLabel="Service (générique, sans agent précis)"
                groups={[
                  { options: availableAgents.map((a) => ({ value: a.uid, label: `${a.name} ${a.surname}` })) },
                ]}
              />
            </div>
          </div>
        )}

        <Button className={`w-fit ${PRIMARY_CTA_CLASS}`} onClick={handleSave} disabled={saving}>
          Enregistrer
        </Button>
      </CardContent>
    </Card>
  )
}

function countAboveGround(etage: string[]): number {
  return etage.filter((e) => e === "RDC" || e.startsWith("étage ")).length
}

function countUnderground(etage: string[]): number {
  return etage.filter((e) => e.startsWith("Sous-sol")).length
}

function buildEtage(floorCount: string, hasUnderground: boolean, undergroundCount: string): string[] {
  const floors = Math.max(0, parseInt(floorCount, 10) || 0)
  const etage: string[] = []
  if (floors >= 1) etage.push("RDC")
  for (let i = 1; i < floors; i++) etage.push(`étage ${i}`)
  if (hasUnderground) {
    const levels = Math.max(0, parseInt(undergroundCount, 10) || 0)
    for (let i = 1; i <= levels; i++) etage.push(`Sous-sol -${i}`)
  }
  return etage
}

function StructuresSection({
  residenceId,
  structures,
}: {
  residenceId: string
  structures: StructureResidence[]
}) {
  const [drafts, setDrafts] = useState<string[]>([])
  // distance: 5 - sans ça, le moindre clic (ex: ouvrir/fermer une carte)
  // déclenche un drag d'un pixel et bloque le onClick normal.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = structures.findIndex((s) => s.id === active.id)
    const newIndex = structures.findIndex((s) => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    try {
      await reorderStructures(residenceId, arrayMove(structures, oldIndex, newIndex).map((s) => s.id))
    } catch (err) {
      toast.error("Échec de la réorganisation : " + (err as Error).message)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Structures / bâtiments</CardTitle>
        <CardDescription>
          Chaque bâtiment déclaré ici devient un emplacement sélectionnable pour les lots ci-dessous.
          Glissez une carte par sa poignée pour réordonner.
        </CardDescription>
        <CardAction>
          <Button
            type="button"
            variant="outline"
            onClick={() => setDrafts((prev) => [...prev, crypto.randomUUID()])}
          >
            <Plus />
            Ajouter un bâtiment
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={structures.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {structures.map((structure) => (
              <SortableStructureCard key={structure.id} residenceId={residenceId} structure={structure} />
            ))}
          </SortableContext>
        </DndContext>
        {drafts.map((tempId) => (
          <StructureCard
            key={tempId}
            residenceId={residenceId}
            nextOrder={structures.length}
            onDiscard={() => setDrafts((prev) => prev.filter((d) => d !== tempId))}
          />
        ))}
        {structures.length === 0 && drafts.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun bâtiment pour l'instant.</p>
        )}
      </CardContent>
    </Card>
  )
}

// Poignée de drag isolée du bouton d'expansion (cf. SortableStructureCard) -
// sans ça, le listener de drag capte aussi le clic normal sur toute la
// carte et empêche de la déplier.
type DragHandleProps = {
  attributes: ReturnType<typeof useSortable>["attributes"]
  listeners: ReturnType<typeof useSortable>["listeners"]
}

function SortableStructureCard({
  residenceId,
  structure,
}: {
  residenceId: string
  structure: StructureResidence
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: structure.id,
  })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "z-10 opacity-50")}
    >
      <StructureCard residenceId={residenceId} structure={structure} dragHandleProps={{ attributes, listeners }} />
    </div>
  )
}

function StructureCard({
  residenceId,
  structure,
  nextOrder,
  dragHandleProps,
  onDiscard,
}: {
  residenceId: string
  structure?: StructureResidence
  nextOrder?: number
  dragHandleProps?: DragHandleProps
  onDiscard?: () => void
}) {
  const [expanded, setExpanded] = useState(!structure)
  const [name, setName] = useState(structure?.name ?? "")
  const [type, setType] = useState(structure?.type ?? "")
  const [floorCount, setFloorCount] = useState(String(countAboveGround(structure?.etage ?? [])))
  const [hasUnderground, setHasUnderground] = useState(structure?.hasUnderground ?? false)
  const [undergroundCount, setUndergroundCount] = useState(
    String(countUnderground(structure?.etage ?? []))
  )
  const [elements, setElements] = useState<string[]>(structure?.elements ?? [])
  const [customElement, setCustomElement] = useState("")
  const [saving, setSaving] = useState(false)

  function toggleElement(el: string) {
    setElements((prev) => (prev.includes(el) ? prev.filter((e) => e !== el) : [...prev, el]))
  }

  function addCustomElement() {
    const trimmed = customElement.trim()
    if (!trimmed || elements.includes(trimmed)) return
    setElements((prev) => [...prev, trimmed])
    setCustomElement("")
  }

  async function handleSave() {
    if (!name.trim() || !type.trim()) {
      toast.error("Le nom et le type du bâtiment sont obligatoires.")
      return
    }
    setSaving(true)
    try {
      const input: StructureInput = {
        name: name.trim(),
        type,
        etage: buildEtage(floorCount, hasUnderground, undergroundCount),
        hasUnderground,
        elements,
      }
      if (structure) {
        await updateStructure(residenceId, structure.id, input)
        toast.success("Bâtiment mis à jour")
      } else {
        await createStructure(residenceId, input, nextOrder ?? 0)
        toast.success("Bâtiment créé")
        onDiscard?.()
      }
    } catch (err) {
      toast.error("Échec de l'enregistrement : " + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!structure) {
      onDiscard?.()
      return
    }
    try {
      await deleteStructure(residenceId, structure.id)
      toast.success("Bâtiment supprimé")
    } catch (err) {
      toast.error("Échec de la suppression : " + (err as Error).message)
    }
  }

  return (
    <div className="rounded-lg border bg-background">
      <div className="flex items-center gap-1 px-1">
        {dragHandleProps && (
          <button
            type="button"
            className="flex shrink-0 cursor-grab touch-none items-center justify-center p-1.5 text-muted-foreground active:cursor-grabbing"
            aria-label="Réordonner ce bâtiment"
            {...dragHandleProps.attributes}
            {...dragHandleProps.listeners}
          >
            <GripVertical className="size-4" />
          </button>
        )}
        <button
          type="button"
          className="flex flex-1 items-center justify-between py-2.5 pr-3 text-left text-sm font-medium"
          onClick={() => setExpanded((e) => !e)}
        >
          {name ? `${type} ${name}`.trim() : "Nouveau bâtiment"}
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
        </button>
      </div>
      {expanded && (
        <div className="flex flex-col gap-5 border-t p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2.5">
              <Label>Nom du bâtiment</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2.5">
              <Label>Type</Label>
              <SearchableSelect
                value={type}
                onChange={setType}
                emptyLabel="—"
                groups={[{ options: structureTypeOptions.map((opt) => ({ value: opt, label: opt })) }]}
              />
            </div>
            <div className="flex flex-col gap-2.5">
              <Label>Nombre d'étages (RDC inclus)</Label>
              <Input
                type="number"
                min={0}
                value={floorCount}
                onChange={(e) => setFloorCount(e.target.value)}
              />
            </div>
            <div className="flex flex-col justify-end gap-2.5">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input"
                  checked={hasUnderground}
                  onChange={(e) => setHasUnderground(e.target.checked)}
                />
                Sous-sol
              </label>
              {hasUnderground && (
                <Input
                  type="number"
                  min={0}
                  placeholder="Niveaux de sous-sol"
                  value={undergroundCount}
                  onChange={(e) => setUndergroundCount(e.target.value)}
                />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <Label>Éléments (cage d'escalier, boîte aux lettres…)</Label>
            <div className="flex flex-wrap gap-x-3 gap-y-3">
              {structureElementOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleElement(option)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-xs transition-colors",
                    elements.includes(option)
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-input text-muted-foreground hover:text-foreground"
                  )}
                >
                  {option}
                </button>
              ))}
              {elements
                .filter((el) => !structureElementOptions.includes(el))
                .map((custom) => (
                  <button
                    key={custom}
                    type="button"
                    onClick={() => toggleElement(custom)}
                    className="flex items-center gap-1.5 rounded-full border border-transparent bg-primary px-3.5 py-1.5 text-xs text-primary-foreground"
                  >
                    {custom}
                    <X className="size-3" />
                  </button>
                ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Ajouter un élément personnalisé"
                value={customElement}
                onChange={(e) => setCustomElement(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomElement())}
                className="max-w-64"
              />
              <Button type="button" variant="outline" size="sm" onClick={addCustomElement}>
                <Plus />
                Ajouter
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={handleDelete}>
              <Trash2 />
              Supprimer
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={saving} className={PRIMARY_CTA_CLASS}>
              Enregistrer
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

type ClefChargeRow = {
  key: string
  id?: string
  nom: string
  // Non éditable ici : recalculé à partir de tantiemesParLot (jamais stocké
  // tel quel, cf. types/clefCharge.ts:totalTantiemes) - affiché en lecture
  // seule à titre de repère.
  total: number
  tantiemesParLot: Record<string, number>
}

type AccessRowState = {
  key: string
  label: string
  type: AccessPointTypeValue
  code: string
  details: string
}

function toAccessRow(key: string, label: string, accessPoint?: AccessPoint | null): AccessRowState {
  return {
    key,
    label,
    type: accessPoint?.type ?? AccessPointType.code,
    code: accessPoint?.code ?? "",
    details: accessPoint?.details ?? "",
  }
}

// Moyens d'accès (digicode/badge/clé) de la résidence et de chaque bâtiment -
// une ligne "Résidence (portail)" toujours présente + une ligne par bâtiment
// déclaré dans la section Structures ci-dessus. Affiché au prestataire sur
// le lien de partage d'une intervention (cf. get_shared_intervention,
// functions_python/main.py). Même patron d'édition inline auto-enregistrée
// (debounce) que ClesChargeSection/LotsSection - la résidence est stockée à
// part (residences/{id}/access/main, cf. lib/accessPoints.ts), chaque
// bâtiment sur son propre document (structures/{id}.accessPoint).
function SecurityAccessSection({
  residenceId,
  structures,
}: {
  residenceId: string
  structures: StructureResidence[]
}) {
  const [residenceAccessPoint, setResidenceAccessPointState] = useState<AccessPoint | null>(null)
  const [rows, setRows] = useState<AccessRowState[]>([])
  const rowsRef = useRef<AccessRowState[]>([])
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    rowsRef.current = rows
  }, [rows])

  useEffect(() => {
    const timers = saveTimers.current
    return () => {
      Object.values(timers).forEach(clearTimeout)
    }
  }, [])

  useEffect(() => {
    return subscribeToResidenceAccessPoint(
      residenceId,
      setResidenceAccessPointState,
      (error) => toast.error("Impossible de charger l'accès résidence : " + error.message)
    )
  }, [residenceId])

  useEffect(() => {
    const next = [
      toAccessRow("residence", "Résidence (portail)", residenceAccessPoint),
      ...structures.map((s) => toAccessRow(s.id, `${s.type} ${s.name}`.trim(), s.accessPoint)),
    ]
    setRows(next)
    rowsRef.current = next
  }, [residenceAccessPoint, structures])

  function schedulePersist(key: string) {
    clearTimeout(saveTimers.current[key])
    saveTimers.current[key] = setTimeout(() => void persistRow(key), 600)
  }

  async function persistRow(key: string) {
    const row = rowsRef.current.find((r) => r.key === key)
    if (!row) return
    const accessPoint: AccessPoint = {
      type: row.type,
      ...(row.type === AccessPointType.code && row.code.trim() ? { code: row.code.trim() } : {}),
      ...(row.details.trim() ? { details: row.details.trim() } : {}),
    }
    try {
      if (row.key === "residence") {
        await saveResidenceAccessPoint(residenceId, accessPoint)
      } else {
        await setStructureAccessPoint(residenceId, row.key, accessPoint)
      }
    } catch (err) {
      toast.error("Échec de l'enregistrement : " + (err as Error).message)
    }
  }

  function updateRow(key: string, patch: Partial<AccessRowState>) {
    setRows((prev) => {
      const next = prev.map((r) => (r.key === key ? { ...r, ...patch } : r))
      rowsRef.current = next
      return next
    })
    schedulePersist(key)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sécurité & accès</CardTitle>
        <CardDescription>
          Digicode, badge ou clé pour entrer dans la résidence et dans chaque bâtiment - affiché au
          prestataire sur le lien d'intervention qui lui est envoyé.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.key} className="rounded-xl border p-3">
            <Label className="mb-2 block text-xs font-semibold text-muted-foreground">{row.label}</Label>
            <div className="grid gap-2 sm:grid-cols-[140px_110px_1fr]">
              <select
                value={row.type}
                onChange={(e) => updateRow(row.key, { type: e.target.value as AccessPointTypeValue })}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {Object.entries(accessPointTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {row.type === AccessPointType.code ? (
                <Input
                  placeholder="Code"
                  value={row.code}
                  onChange={(e) => updateRow(row.key, { code: e.target.value })}
                />
              ) : (
                <div />
              )}
              <Input
                placeholder="Précisions (ex : badge à retirer à la loge)"
                value={row.details}
                onChange={(e) => updateRow(row.key, { details: e.target.value })}
                className={row.type === AccessPointType.code ? undefined : "sm:col-span-2"}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// Gestion des clés de répartition des charges de la résidence (charges
// générales, ascenseur, chauffage...) - même patron d'édition inline
// auto-enregistrée que LotsSection, en plus simple (pas de drag, pas de
// recherche). Le tantième de chaque lot pour chacune de ces clés se règle
// depuis le tableau des lots ci-dessous (bouton "Répartition" par ligne), pas
// ici - seul le nom de la clé s'édite dans ce tableau.
function ClesChargeSection({ residenceId }: { residenceId: string }) {
  const [rows, setRows] = useState<ClefChargeRow[]>([])
  const [loading, setLoading] = useState(true)
  const rowsRef = useRef<ClefChargeRow[]>([])
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    rowsRef.current = rows
  }, [rows])

  useEffect(() => {
    const timers = saveTimers.current
    return () => {
      Object.values(timers).forEach(clearTimeout)
    }
  }, [])

  useEffect(() => {
    return subscribeToClesCharge(
      residenceId,
      (clesCharge) => {
        setRows(
          clesCharge.map((c) => ({
            key: c.id,
            id: c.id,
            nom: c.nom,
            total: totalTantiemes(c),
            tantiemesParLot: c.tantiemesParLot,
          }))
        )
        setLoading(false)
      },
      (error) => {
        toast.error("Impossible de charger les clés de charges : " + error.message)
        setLoading(false)
      }
    )
  }, [residenceId])

  async function persistRow(key: string) {
    const row = rowsRef.current.find((r) => r.key === key)
    if (!row?.id) return
    const nom = row.nom.trim()
    // Ligne encore incomplète (saisie en cours) : on attend simplement,
    // aucune erreur tant que l'utilisateur n'a pas donné de nom.
    if (!nom) return
    try {
      await updateClefChargeNom(residenceId, row.id, nom)
    } catch (err) {
      toast.error("Échec de l'enregistrement : " + (err as Error).message)
    }
  }

  function schedulePersist(key: string) {
    clearTimeout(saveTimers.current[key])
    saveTimers.current[key] = setTimeout(() => {
      void persistRow(key)
    }, 600)
  }

  function updateRow(key: string, nom: string) {
    setRows((prev) => {
      const next = prev.map((row) => (row.key === key ? { ...row, nom } : row))
      rowsRef.current = next
      return next
    })
    schedulePersist(key)
  }

  async function addRow() {
    try {
      const id = await createClefCharge(residenceId, "")
      setRows((prev) =>
        prev.some((r) => r.id === id)
          ? prev
          : [...prev, { key: id, id, nom: "", total: 0, tantiemesParLot: {} }]
      )
    } catch (err) {
      toast.error("Échec de la création : " + (err as Error).message)
    }
  }

  async function removeRow(row: ClefChargeRow) {
    if (!row.id) return
    clearTimeout(saveTimers.current[row.key])
    try {
      await deleteClefCharge(residenceId, row.id)
      toast.success("Clé de charges supprimée")
    } catch (err) {
      toast.error("Échec de la suppression : " + (err as Error).message)
      return
    }
    setRows((prev) => prev.filter((r) => r.key !== row.key))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clés de charges</CardTitle>
        <CardDescription>
          Chaque clé définit une répartition des charges (charges générales, ascenseur…). Le tantième de
          chaque lot pour cette clé se règle depuis le tableau des lots ci-dessous (bouton "Répartition").
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Total tantièmes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>
                    <Input
                      placeholder="Ex : Charges générales"
                      value={row.nom}
                      onChange={(e) => updateRow(row.key, e.target.value)}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.total}</TableCell>
                  <TableCell className="text-right">
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeRow(row)}>
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                    Aucune clé de charges pour l'instant.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={addRow}>
            <Plus />
            Ajouter une clé
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

type LotRow = {
  key: string
  id?: string
  refLot: string
  batiment: string
  lot: string
  typeLot: string
  isLinkable: boolean
  idProprietaire: string[]
  // Lot principal (isLinkable=false) auquel CE lot est rattaché - null si
  // aucun. Sélectionnable uniquement quand isLinkable est coché (cf.
  // SortableLotRow, colonne "Rattaché à").
  parentLotId: string | null
  // Tantième général du lot (loi de 1965) - édité inline comme les autres
  // champs. Distinct de la répartition par clé de charge dédiée (bouton
  // "Répartition", cf. LotClefsChargeDialog).
  tantiemes: number
}

function matchesLotSearch(row: LotRow, search: string): boolean {
  const trimmed = search.trim().toLowerCase()
  if (!trimmed) return true
  const haystack = [row.batiment, row.lot, row.refLot, row.typeLot].join(" ").toLowerCase()
  return haystack.includes(trimmed)
}

function LotsSection({
  residenceId,
  structures,
}: {
  residenceId: string
  structures: StructureResidence[]
}) {
  const [rows, setRows] = useState<LotRow[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [search, setSearch] = useState("")
  const [clesCharge, setClesCharge] = useState<ClefCharge[]>([])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  // Miroir synchrone de `rows`, lu depuis les callbacks différés
  // (setTimeout de schedulePersist) ou depuis handleDragEnd juste après un
  // setRows - un `rows` capturé dans une closure au moment du rendu y serait
  // périmé au moment où le timer se déclenche.
  const rowsRef = useRef<LotRow[]>([])
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    rowsRef.current = rows
  }, [rows])

  useEffect(() => {
    const timers = saveTimers.current
    return () => {
      Object.values(timers).forEach(clearTimeout)
    }
  }, [])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setRows((prev) => {
      const oldIndex = prev.findIndex((r) => r.key === active.id)
      const newIndex = prev.findIndex((r) => r.key === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      const next = arrayMove(prev, oldIndex, newIndex)
      // Enregistré immédiatement (pas de bouton "Enregistrer" séparé) - tous
      // les lots affichés sont déjà persistés à ce stade (addRow crée en
      // base tout de suite), donc chaque row.id est fiable ici.
      const orderedIds = next.map((r) => r.id).filter((id): id is string => !!id)
      reorderLots(residenceId, orderedIds).catch((err) => {
        toast.error("Échec de la réorganisation : " + (err as Error).message)
      })
      return next
    })
  }

  useEffect(() => {
    return subscribeToLots(
      residenceId,
      (lots) => {
        // Remplacement complet : chaque lot affiché est désormais toujours
        // persisté dès sa création (addRow), plus de brouillon local sans id
        // à préserver entre deux synchronisations Firestore.
        setRows(
          lots.map((lot) => ({
            key: lot.id,
            id: lot.id,
            refLot: lot.refLot,
            batiment: lot.batiment,
            lot: lot.lot,
            typeLot: lot.typeLot,
            isLinkable: lot.isLinkable,
            idProprietaire: lot.idProprietaire,
            parentLotId: lot.parentLotId ?? null,
            tantiemes: lot.tantiemes,
          }))
        )
        setLoading(false)
      },
      (error) => {
        toast.error("Impossible de charger les lots : " + error.message)
        setLoading(false)
      }
    )
  }, [residenceId])

  useEffect(() => {
    return subscribeToClesCharge(
      residenceId,
      setClesCharge,
      (error) => toast.error("Impossible de charger les clés de charges : " + error.message)
    )
  }, [residenceId])

  const buildingOptions = structures.map((s) => `${s.type} ${s.name}`.trim())
  const filteredRows = useMemo(() => rows.filter((row) => matchesLotSearch(row, search)), [rows, search])

  // Un lot qui reprendrait la référence ou le bâtiment+numéro d'un autre lot
  // déjà affiché n'est jamais persisté - revérifié à chaque tentative
  // d'enregistrement de cette ligne (donc dès que l'utilisateur corrige).
  function findConflict(row: LotRow): string | null {
    const refLot = row.refLot.trim()
    const batiment = row.batiment.trim()
    const lot = row.lot.trim()
    const others = rowsRef.current.filter((r) => r.key !== row.key)
    if (refLot && others.some((r) => r.refLot.trim() === refLot)) {
      return `Référence en double : ${refLot}`
    }
    if (batiment && lot && others.some((r) => r.batiment.trim() === batiment && r.lot.trim() === lot)) {
      return `Doublon : bâtiment "${batiment}", lot "${lot}"`
    }
    return null
  }

  async function persistRow(key: string) {
    const row = rowsRef.current.find((r) => r.key === key)
    if (!row?.id) return
    const refLot = row.refLot.trim()
    const batiment = row.batiment.trim()
    const lot = row.lot.trim()
    // Ligne encore incomplète (saisie en cours) : on attend simplement,
    // aucune erreur tant que l'utilisateur n'a pas fini de la remplir.
    if (!refLot || !batiment || !lot) return
    const conflict = findConflict(row)
    if (conflict) {
      toast.error(conflict)
      return
    }
    const input: LotInput = {
      refLot,
      batiment,
      lot,
      typeLot: row.typeLot,
      isLinkable: row.isLinkable,
      order: rowsRef.current.findIndex((r) => r.key === key),
      tantiemes: row.tantiemes,
    }
    try {
      await updateLot(residenceId, row.id, input)
    } catch (err) {
      toast.error("Échec de l'enregistrement : " + (err as Error).message)
    }
  }

  // Champs texte (refLot/lot) : attend une pause dans la saisie avant
  // d'écrire, pour ne pas envoyer une requête à chaque frappe. Select/case à
  // cocher (batiment/typeLot/isLinkable) : écriture immédiate, ce sont des
  // choix discrets, pas une saisie continue.
  function schedulePersist(key: string, immediate: boolean) {
    clearTimeout(saveTimers.current[key])
    if (immediate) {
      void persistRow(key)
      return
    }
    saveTimers.current[key] = setTimeout(() => {
      void persistRow(key)
    }, 600)
  }

  async function addRow() {
    try {
      const id = await createLot(residenceId, {
        refLot: "",
        batiment: "",
        lot: "",
        typeLot: "",
        isLinkable: false,
        order: rowsRef.current.length,
        tantiemes: 0,
      })
      // Ajout optimiste, mais seulement si subscribeToLots n'a pas déjà
      // ramené ce même lot entre-temps (sinon deux lignes partageraient la
      // même key/id, faussant rows.length pour le prochain addRow).
      setRows((prev) => (prev.some((r) => r.id === id) ? prev : [...prev, {
        key: id,
        id,
        refLot: "",
        batiment: "",
        lot: "",
        typeLot: "",
        isLinkable: false,
        idProprietaire: [],
        parentLotId: null,
        tantiemes: 0,
      }]))
    } catch (err) {
      toast.error("Échec de la création : " + (err as Error).message)
    }
  }

  function updateRow(key: string, patch: Partial<LotRow>, options?: { immediate?: boolean }) {
    setRows((prev) => {
      const next = prev.map((row) => (row.key === key ? { ...row, ...patch } : row))
      // Synchronisé ICI, pas seulement via l'effect [rows] : pour une
      // sauvegarde immédiate (typeLot/batiment/isLinkable), persistRow tourne
      // sur le même tick que ce setRows, avant que l'effect n'ait eu la
      // chance de se déclencher - sans cette ligne, rowsRef.current restait
      // sur la valeur PRÉCÉDENTE et persistRow réécrivait l'ancienne valeur.
      rowsRef.current = next
      return next
    })
    schedulePersist(key, options?.immediate ?? false)
  }

  async function removeRow(row: LotRow) {
    if (row.idProprietaire.length > 0) {
      toast.error(
        "Ce lot est déjà rattaché à un propriétaire, il n'est plus possible de le supprimer."
      )
      return
    }
    if (!row.id) return
    clearTimeout(saveTimers.current[row.key])
    try {
      await deleteLot(residenceId, row.id)
      toast.success("Lot supprimé")
    } catch (err) {
      toast.error("Échec de la suppression : " + (err as Error).message)
      return
    }
    setRows((prev) => prev.filter((r) => r.key !== row.key))
  }

  async function handleLinkLot(row: LotRow, parentLotId: string | null) {
    if (!row.id) return
    const previous = row.parentLotId
    setRows((prev) => {
      const next = prev.map((r) => (r.key === row.key ? { ...r, parentLotId } : r))
      rowsRef.current = next
      return next
    })
    try {
      await linkLot(residenceId, row.id, parentLotId)
    } catch (err) {
      toast.error("Échec du rattachement : " + (err as Error).message)
      setRows((prev) => {
        const next = prev.map((r) => (r.key === row.key ? { ...r, parentLotId: previous } : r))
        rowsRef.current = next
        return next
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lots</CardTitle>
        <CardDescription>
          Les modifications sont enregistrées automatiquement. Glissez une ligne par sa poignée pour
          réordonner.
        </CardDescription>
        <CardAction>
          <Button type="button" variant="outline" onClick={() => setImporting(true)}>
            <Upload />
            Importer
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un lot…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Bâtiment</TableHead>
                <TableHead>N°</TableHead>
                <TableHead>Référence</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Tantièmes</TableHead>
                <TableHead>Rattachable</TableHead>
                <TableHead>Rattaché à</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={filteredRows.map((r) => r.key)} strategy={verticalListSortingStrategy}>
                  {filteredRows.map((row) => (
                    <SortableLotRow
                      key={row.key}
                      residenceId={residenceId}
                      row={row}
                      allRows={rows}
                      buildingOptions={buildingOptions}
                      clesCharge={clesCharge}
                      updateRow={updateRow}
                      removeRow={removeRow}
                      onLink={handleLinkLot}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    Aucun lot pour l'instant.
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.length > 0 && filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    Aucun lot ne correspond à la recherche.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={addRow}>
            <Plus />
            Ajouter une ligne
          </Button>
        </div>
      </CardContent>

      <LotImportDialog
        open={importing}
        onOpenChange={setImporting}
        existingLots={rows}
        clesCharge={clesCharge}
        structures={structures}
        onImport={async (validation) => {
          await importLots(residenceId, validation, rowsRef.current.length, structures.length)
        }}
      />
    </Card>
  )
}

function SortableLotRow({
  residenceId,
  row,
  allRows,
  buildingOptions,
  clesCharge,
  updateRow,
  removeRow,
  onLink,
}: {
  residenceId: string
  row: LotRow
  allRows: LotRow[]
  buildingOptions: string[]
  clesCharge: ClefCharge[]
  updateRow: (key: string, patch: Partial<LotRow>, options?: { immediate?: boolean }) => void
  removeRow: (row: LotRow) => void
  onLink: (row: LotRow, parentLotId: string | null) => void
}) {
  const [repartitionOpen, setRepartitionOpen] = useState(false)
  // Lots "principaux" (isLinkable non coché) pouvant servir de parent -
  // jamais la ligne elle-même.
  const parentOptions = allRows.filter(
    (r): r is LotRow & { id: string } => !!r.id && r.id !== row.id && !r.isLinkable
  )
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.key,
  })
  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative", isDragging && "z-10 opacity-50")}
    >
      <TableCell>
        <button
          type="button"
          className="flex cursor-grab touch-none items-center justify-center text-muted-foreground active:cursor-grabbing"
          aria-label="Réordonner cette ligne"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
      </TableCell>
      <TableCell>
        <SearchableSelect
          className="min-w-32"
          value={row.batiment}
          onChange={(v) => updateRow(row.key, { batiment: v }, { immediate: true })}
          emptyLabel="—"
          groups={[{ options: buildingOptions.map((opt) => ({ value: opt, label: opt })) }]}
        />
      </TableCell>
      <TableCell>
        <Input className="w-20" value={row.lot} onChange={(e) => updateRow(row.key, { lot: e.target.value })} />
      </TableCell>
      <TableCell>
        <Input
          className="w-32"
          value={row.refLot}
          onChange={(e) => updateRow(row.key, { refLot: e.target.value })}
        />
      </TableCell>
      <TableCell>
        <SearchableSelect
          className="min-w-40"
          value={row.typeLot}
          onChange={(v) =>
            updateRow(
              row.key,
              { typeLot: v, isLinkable: defaultIsLinkableForType(v) },
              { immediate: true }
            )
          }
          emptyLabel="—"
          groups={[{ options: typeLotOptions.map((opt) => ({ value: opt, label: opt })) }]}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={0}
          className="w-20"
          value={row.tantiemes}
          onChange={(e) => updateRow(row.key, { tantiemes: Number(e.target.value) || 0 })}
        />
      </TableCell>
      <TableCell>
        <input
          type="checkbox"
          className="size-4 rounded border-input"
          checked={row.isLinkable}
          onChange={(e) => updateRow(row.key, { isLinkable: e.target.checked }, { immediate: true })}
        />
      </TableCell>
      <TableCell>
        {row.isLinkable && (
          <SearchableSelect
            className="min-w-40"
            value={row.parentLotId ?? ""}
            onChange={(v) => onLink(row, v || null)}
            emptyLabel="— Aucun —"
            groups={[
              {
                options: [
                  { value: "", label: "— Aucun —" },
                  ...parentOptions.map((r) => ({
                    value: r.id,
                    label: `${r.batiment} - Lot ${r.lot} (${r.refLot})`,
                  })),
                ],
              },
            ]}
          />
        )}
      </TableCell>
      <TableCell className="text-right">
        {row.id && (
          <LotClefsChargeDialog
            open={repartitionOpen}
            onOpenChange={setRepartitionOpen}
            residenceId={residenceId}
            lotId={row.id}
            lotLabel={`${row.batiment} - Lot ${row.lot}`.trim()}
            clesCharge={clesCharge}
          />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger className="ml-auto inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={!row.id} onClick={() => setRepartitionOpen(true)}>
              <Percent />
              Répartition
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!row.id} render={<Link to={`/residences/${residenceId}/lots/${row.id}`} />}>
              <Eye />
              Voir le lot
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              disabled={row.idProprietaire.length > 0}
              onClick={() => removeRow(row)}
            >
              <Trash2 />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

function voteStatusLabel(vote: Vote): string {
  const isAG = vote.type === VoteType.assembleeGenerale
  if (isAG && !isVoteStarted(vote)) return "En attente de lancement"
  if (isAG && isVoteStarted(vote) && !isSessionFinished(vote)) return isVotePaused(vote) ? "En pause" : "En cours"
  const closed = isAG ? isSessionFinished(vote) : isVoteClosed(vote)
  return closed ? "Clos" : "Ouvert"
}

// Sondages et assemblées générales de la résidence - hub de gestion complet
// (création, pilotage de la session live question par question, résultats),
// dont le détail vit sur sa propre page (VoteDetailPage) car une session
// d'AG a un cycle de vie bien plus riche qu'une simple ligne de tableau -
// miroir de ManageVotesPage/VoteDetailPage côté app mobile (connectkasa).
function VotesSection({ residenceId }: { residenceId: string }) {
  const { user } = useAuth()
  const [votes, setVotes] = useState<Vote[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [lots, setLots] = useState<Lot[]>([])
  const [clesCharge, setClesCharge] = useState<ClefCharge[]>([])
  // Rafraîchit périodiquement le statut affiché (isSessionFinished/
  // isVoteClosed sont des calculs purs basés sur l'heure courante, jamais
  // stockés côté Firestore - rien d'autre ne les recalculerait ici).
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setLoading(true)
    return subscribeToVotes(
      residenceId,
      (data) => {
        setVotes(data)
        setLoading(false)
      },
      (error) => {
        toast.error("Impossible de charger les votes : " + error.message)
        setLoading(false)
      }
    )
  }, [residenceId])

  useEffect(() => {
    return subscribeToLots(residenceId, setLots, () => {})
  }, [residenceId])

  useEffect(() => {
    return subscribeToClesCharge(residenceId, setClesCharge, () => {})
  }, [residenceId])

  async function handleDelete(vote: Vote) {
    if (!confirm(`Supprimer "${vote.title || "ce vote"}" ?`)) return
    try {
      await deleteVote(residenceId, vote.id)
      toast.success("Vote supprimé")
    } catch (err) {
      toast.error("Échec de la suppression : " + (err as Error).message)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Votes & assemblées générales</CardTitle>
        <CardDescription>
          Sondages et assemblées générales de la résidence. Le pilotage de la session (lancement des
          questions, chronomètre, résultats) se fait depuis le détail de chaque vote.
        </CardDescription>
        <CardAction>
          <Button type="button" variant="outline" onClick={() => setCreating(true)}>
            <VoteIcon />
            Créer un vote
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titre</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Créé le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {votes.map((vote) => {
                const isAG = vote.type === VoteType.assembleeGenerale
                const deletable = isAG ? !isSessionFinished(vote) : !isVoteClosed(vote)
                return (
                  <TableRow key={vote.id}>
                    <TableCell className="font-medium">{vote.title || "(sans titre)"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{isAG ? "Assemblée générale" : "Sondage"}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{voteStatusLabel(vote)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {vote.createdAt.toDate().toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          render={<Link to={`/residences/${residenceId}/votes/${vote.id}`} />}
                        >
                          <Eye />
                          Voir
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={!deletable}
                          title={!deletable ? "Vote clos, non supprimable" : undefined}
                          onClick={() => handleDelete(vote)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {!loading && votes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Aucun vote pour l'instant.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <VoteFormDialog
        open={creating}
        onOpenChange={setCreating}
        residenceId={residenceId}
        uid={user?.uid ?? ""}
        lots={lots}
        clesCharge={clesCharge}
      />
    </Card>
  )
}
