import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft, ChevronDown, GripVertical, Plus, Trash2, X } from "lucide-react"
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
import { createLot, deleteLot, subscribeToLots, updateLot, type LotInput } from "@/lib/lots"
import { subscribeToGerances } from "@/lib/gerances"
import { resolveUsersByUids } from "@/lib/users"
import { emptyAddress, type Residence } from "@/types/residence"
import { structureElementOptions, structureTypeOptions, type StructureResidence } from "@/types/structure"
import { defaultIsLinkableForType, typeLotOptions } from "@/types/lot"
import { AGENT_UID_FIELD, serviceTypeLabels, type Gerance, type ServiceType } from "@/types/gerance"
import type { KonodalUser } from "@/types/user"
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin"
import { cn } from "@/lib/utils"

export default function ResidenceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [residence, setResidence] = useState<Residence | null>(null)
  const [loading, setLoading] = useState(true)
  const [structures, setStructures] = useState<StructureResidence[]>([])

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
        <h1 className="text-2xl font-semibold">{residence?.name || (loading ? "…" : "Résidence introuvable")}</h1>
      </div>

      {!loading && !residence && (
        <p className="text-muted-foreground">Cette résidence n'existe pas ou a été supprimée.</p>
      )}

      {residence && (
        <>
          <InfoSection residence={residence} />
          <StructuresSection residenceId={id} structures={structures} />
          <LotsSection residenceId={id} structures={structures} />
        </>
      )}
    </div>
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

        <Button className="w-fit" onClick={handleSave} disabled={saving}>
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
        <div className="flex flex-col gap-3 border-t p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Nom du bâtiment</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <SearchableSelect
                value={type}
                onChange={setType}
                emptyLabel="—"
                groups={[{ options: structureTypeOptions.map((opt) => ({ value: opt, label: opt })) }]}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Nombre d'étages (RDC inclus)</Label>
              <Input
                type="number"
                min={0}
                value={floorCount}
                onChange={(e) => setFloorCount(e.target.value)}
              />
            </div>
            <div className="flex flex-col justify-end gap-1.5">
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
            <div className="flex flex-wrap gap-2.5">
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
            <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
              Enregistrer
            </Button>
          </div>
        </div>
      )}
    </div>
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
  const [saving, setSaving] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setRows((prev) => {
      const oldIndex = prev.findIndex((r) => r.key === active.id)
      const newIndex = prev.findIndex((r) => r.key === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  useEffect(() => {
    return subscribeToLots(
      residenceId,
      (lots) => {
        setRows((prev) => [
          ...lots.map((lot) => ({
            key: lot.id,
            id: lot.id,
            refLot: lot.refLot,
            batiment: lot.batiment,
            lot: lot.lot,
            typeLot: lot.typeLot,
            isLinkable: lot.isLinkable,
            idProprietaire: lot.idProprietaire,
          })),
          // Les brouillons pas encore enregistrés (sans id) sont conservés
          // tels quels d'une synchronisation Firestore à l'autre.
          ...prev.filter((row) => !row.id),
        ])
        setLoading(false)
      },
      (error) => {
        toast.error("Impossible de charger les lots : " + error.message)
        setLoading(false)
      }
    )
  }, [residenceId])

  const buildingOptions = structures.map((s) => `${s.type} ${s.name}`.trim())

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        refLot: "",
        batiment: "",
        lot: "",
        typeLot: "",
        isLinkable: false,
        idProprietaire: [],
      },
    ])
  }

  function updateRow(key: string, patch: Partial<LotRow>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  async function removeRow(row: LotRow) {
    if (row.id) {
      if (row.idProprietaire.length > 0) {
        toast.error(
          "Ce lot est déjà rattaché à un propriétaire, il n'est plus possible de le supprimer."
        )
        return
      }
      try {
        await deleteLot(residenceId, row.id)
        toast.success("Lot supprimé")
      } catch (err) {
        toast.error("Échec de la suppression : " + (err as Error).message)
        return
      }
    }
    setRows((prev) => prev.filter((r) => r.key !== row.key))
  }

  async function handleSaveAll() {
    const relevantRows = rows.filter((row) => {
      const isBlank =
        !row.refLot.trim() && !row.batiment.trim() && !row.lot.trim() && !row.typeLot.trim()
      return !(row.id === undefined && isBlank)
    })

    const refLotSeen = new Set<string>()
    const comboSeen = new Set<string>()
    const errors: string[] = []

    relevantRows.forEach((row, index) => {
      const refLot = row.refLot.trim()
      const batiment = row.batiment.trim()
      const lot = row.lot.trim()

      if (!refLot) {
        errors.push(`Le lot n°${index + 1} n'a pas de référence.`)
      } else if (refLotSeen.has(refLot)) {
        errors.push(`Référence en double : ${refLot}`)
      } else {
        refLotSeen.add(refLot)
      }

      if (!batiment || !lot) {
        errors.push(`Le lot n°${index + 1} est incomplet (bâtiment ou numéro manquant).`)
      } else {
        const combo = `${batiment}-${lot}`
        if (comboSeen.has(combo)) {
          errors.push(`Doublon : bâtiment "${batiment}", lot "${lot}"`)
        } else {
          comboSeen.add(combo)
        }
      }
    })

    if (errors.length > 0) {
      toast.error(errors.join(" "))
      return
    }

    setSaving(true)
    try {
      for (const [index, row] of relevantRows.entries()) {
        const input: LotInput = {
          refLot: row.refLot.trim(),
          batiment: row.batiment.trim(),
          lot: row.lot.trim(),
          typeLot: row.typeLot,
          isLinkable: row.isLinkable,
          // Reflète l'ordre visuel actuel (réorganisation click-and-déplace,
          // cf. handleDragEnd) - réécrit à chaque sauvegarde, même pour un
          // lot dont rien d'autre n'a changé.
          order: index,
        }
        if (row.id) {
          await updateLot(residenceId, row.id, input)
        } else {
          await createLot(residenceId, input)
        }
      }
      setRows(relevantRows)
      toast.success("Lots enregistrés")
    } catch (err) {
      toast.error("Échec de l'enregistrement : " + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lots</CardTitle>
        <CardDescription>
          Ajoutez autant de lignes que nécessaire, puis enregistrez-les en une seule fois. Glissez une
          ligne par sa poignée pour réordonner.
        </CardDescription>
        <CardAction>
          <Button type="button" variant="outline" onClick={addRow}>
            <Plus />
            Ajouter une ligne
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Bâtiment</TableHead>
                <TableHead>N°</TableHead>
                <TableHead>Référence</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Rattachable</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={rows.map((r) => r.key)} strategy={verticalListSortingStrategy}>
                  {rows.map((row) => (
                    <SortableLotRow
                      key={row.key}
                      row={row}
                      buildingOptions={buildingOptions}
                      updateRow={updateRow}
                      removeRow={removeRow}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Aucun lot pour l'instant.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={handleSaveAll} disabled={saving}>
            Enregistrer les lots
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function SortableLotRow({
  row,
  buildingOptions,
  updateRow,
  removeRow,
}: {
  row: LotRow
  buildingOptions: string[]
  updateRow: (key: string, patch: Partial<LotRow>) => void
  removeRow: (row: LotRow) => void
}) {
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
          onChange={(v) => updateRow(row.key, { batiment: v })}
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
            updateRow(row.key, {
              typeLot: v,
              isLinkable: defaultIsLinkableForType(v),
            })
          }
          emptyLabel="—"
          groups={[{ options: typeLotOptions.map((opt) => ({ value: opt, label: opt })) }]}
        />
      </TableCell>
      <TableCell>
        <input
          type="checkbox"
          className="size-4 rounded border-input"
          checked={row.isLinkable}
          onChange={(e) => updateRow(row.key, { isLinkable: e.target.checked })}
        />
      </TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={row.idProprietaire.length > 0}
          title={row.idProprietaire.length > 0 ? "Lot déjà rattaché à un propriétaire" : undefined}
          onClick={() => removeRow(row)}
        >
          <Trash2 />
        </Button>
      </TableCell>
    </TableRow>
  )
}
