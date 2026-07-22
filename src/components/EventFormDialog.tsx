import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Ban, ChevronDown, Save } from "lucide-react"
import { doc, getDoc } from "firebase/firestore"
import { getDownloadURL, ref } from "firebase/storage"
import { Button } from "@/components/ui/button"
import { DateInput } from "@/components/DateInput"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { db, storage } from "@/firebase"
import { GERANCE_PLACEHOLDER_LOGO_URL, type EventInput } from "@/lib/events"
import { subscribeToContacts } from "@/lib/contacts"
import { subscribeToStructures } from "@/lib/structures"
import { resolveUsersByUids } from "@/lib/users"
import { CONTACT_SERVICE_ICON_FILENAMES, type Contact } from "@/types/contact"
import type { GeranceRef } from "@/types/residence"
import type { StructureResidence } from "@/types/structure"
import { cn } from "@/lib/utils"

// Seuls id/name/contactRefs/geranceRef sont utilisés ici (sélecteur de
// résidence + liste des prestataires rattachés + gérance de la résidence) -
// un type minimal évite d'imposer le modèle Residence complet à l'appelant.
type ResidenceOption = {
  id: string
  name: string
  contactRefs?: Record<string, boolean>
  geranceRef?: GeranceRef
}

// Date et heure séparées (plutôt qu'un seul <input type="datetime-local">) :
// ce dernier bloque la soumission (required) tant que les DEUX parties ne
// sont pas remplies, ce qui surprend si on ne renseigne que la date - ici
// l'heure est optionnelle et retombe sur minuit si laissée vide.
function dateToLocalParts(date: Date): { dateOnly: string; time: string } {
  const pad = (n: number) => String(n).padStart(2, "0")
  return {
    dateOnly: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  }
}

// Résout la photo associée au prestataire choisi - placeholder gérance, ou
// icône du service du contact (assets/icones_presta/ dans Storage, même
// fichiers que _prestaIconFileName côté app mobile). Partagé entre l'aperçu
// live (pendant la saisie) et handleSubmit (valeur réellement enregistrée),
// pour ne jamais désynchroniser les deux. Si aucun des deux ne matche ou si
// le fichier est introuvable, retombe sur `fallback` (photo déjà présente
// en édition, "" en création) plutôt que de l'écraser par du vide.
async function resolvePrestaImage(
  name: string,
  geranceAgentLabel: string | null,
  contacts: Contact[],
  fallback: string
): Promise<string> {
  if (geranceAgentLabel && name === geranceAgentLabel) {
    return GERANCE_PLACEHOLDER_LOGO_URL
  }
  const contact = contacts.find((c) => c.name === name)
  if (!contact) return fallback
  const fileName =
    CONTACT_SERVICE_ICON_FILENAMES[contact.service as keyof typeof CONTACT_SERVICE_ICON_FILENAMES]
  if (!fileName) return fallback
  try {
    return await getDownloadURL(ref(storage, `assets/icones_presta/${fileName}`))
  } catch {
    return fallback
  }
}

// Libellé complet d'un bâtiment/structure : "type + espace + name" (ex:
// "Bâtiment B"), même format que ResidenceDetailPage.tsx et que ce qui est
// stocké tel quel dans location.locationElements côté app mobile (le
// résident choisit directement ce libellé complet, pas juste `name`) -
// utiliser `s.name` seul ici ferait que ce champ ne matche jamais la valeur
// réellement enregistrée sur un sinistre/event.
function structureLabel(s: StructureResidence): string {
  return `${s.type} ${s.name}`.trim()
}

// Pré-remplissage partiel (titre/localisation) lors de la création d'une
// intervention depuis "Programmer une intervention" sur une fiche sinistre -
// distinct de `initial` (édition complète, avec date et prestataire déjà
// connus) : ici la date, le prestataire et la description restent à
// choisir/saisir, jamais déduits du sinistre.
type PrefillFromSinistre = {
  title: string
  locationElement: string
  locationFloor: string
}

type EventFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  residences: ResidenceOption[]
  initialResidenceId?: string
  lockResidence?: boolean
  initial?: EventInput
  prefillFromSinistre?: PrefillFromSinistre
  // Non éditable dans ce formulaire - fourni uniquement par le CTA "Programmer
  // une intervention" de SinistreDetailPage, pour lier l'intervention créée
  // au ticket d'origine.
  linkedSinistreId?: string
  onSubmit: (residenceId: string, input: EventInput) => Promise<void>
  // Fourni uniquement en mode édition (EvenementDetailPage) - absent en
  // création (EvenementsPage/SinistreDetailPage), où annuler n'a pas de sens.
  // scope "chain" annule aussi toutes les interventions liées par
  // reprogrammations successives (cf. collectEventChain dans lib/events.ts).
  onCancel?: (scope: "single" | "chain") => Promise<void>
  // Intervention déjà reportée (remplacée par une reprogrammation) : les
  // champs n'ont plus de sens à modifier (la date/le prestataire affichés
  // sont obsolètes), seule l'annulation reste possible - cf. onCancel.
  readOnly?: boolean
}

// Le contenu (et son état) n'est monté QUE quand la modale est ouverte : un
// nouveau montage à chaque ouverture lit `initial`/`prefillFromSinistre`
// directement dans les initialiseurs useState, sans dépendre d'un useEffect
// de réinitialisation sur `open` (source d'un bug de pré-remplissage qui ne
// se déclenchait pas de façon fiable).
export function EventFormDialog({ open, onOpenChange, ...formProps }: EventFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && <EventFormDialogContent {...formProps} />}
      </DialogContent>
    </Dialog>
  )
}

function EventFormDialogContent({
  title,
  residences,
  initialResidenceId,
  lockResidence,
  initial,
  prefillFromSinistre,
  linkedSinistreId,
  onSubmit,
  onCancel,
  readOnly,
}: Omit<EventFormDialogProps, "open" | "onOpenChange">) {
  const [residenceId, setResidenceId] = useState(initialResidenceId ?? "")
  const [eventTitle, setEventTitle] = useState(initial?.title ?? prefillFromSinistre?.title ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [eventDateOnly, setEventDateOnly] = useState(
    initial?.eventDate ? dateToLocalParts(initial.eventDate).dateOnly : ""
  )
  const [eventTime, setEventTime] = useState(
    initial?.eventDate ? dateToLocalParts(initial.eventDate).time : ""
  )
  const [prestaName, setPrestaName] = useState(initial?.prestaName ?? "")
  const [pathImage, setPathImage] = useState(initial?.pathImage ?? "")
  const [locationElement, setLocationElement] = useState(
    initial?.locationElement ?? prefillFromSinistre?.locationElement ?? ""
  )
  const [locationFloor, setLocationFloor] = useState(
    initial?.locationFloor ?? prefillFromSinistre?.locationFloor ?? ""
  )
  const [submitting, setSubmitting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [structures, setStructures] = useState<StructureResidence[]>([])
  const [geranceAgentLabel, setGeranceAgentLabel] = useState<string | null>(null)

  useEffect(() => {
    return subscribeToContacts(setContacts, () => {
      toast.error("Impossible de charger les contacts")
    })
  }, [])

  // Bâtiment/étage dépendent de la résidence choisie (structures propres à
  // chaque résidence, cf. ResidenceDetailPage) - reset si on change de
  // résidence pour ne pas garder une sélection qui n'a plus de sens.
  useEffect(() => {
    if (!residenceId) {
      setStructures([])
      return
    }
    return subscribeToStructures(residenceId, setStructures, () => {
      toast.error("Impossible de charger les bâtiments de la résidence")
    })
  }, [residenceId])

  const selectedResidence = residences.find((r) => r.id === residenceId)
  const geranceRef = selectedResidence?.geranceRef

  // Résout l'agent (ou à défaut l'agence) rattaché à la résidence via
  // geranceRef, pour le proposer comme prestataire au même titre que les
  // contacts de la résidence - la gérance/le syndic peut aussi intervenir
  // directement.
  useEffect(() => {
    if (!geranceRef) {
      setGeranceAgentLabel(null)
      return
    }
    let cancelled = false
    Promise.all([
      getDoc(doc(db, "gerances", geranceRef.geranceId)),
      geranceRef.agentUid ? resolveUsersByUids([geranceRef.agentUid]) : Promise.resolve([]),
    ]).then(([snap, agentUsers]) => {
      if (cancelled || !snap.exists()) return
      const geranceName = (snap.data().name as string) ?? ""
      const agentUser = agentUsers[0]
      if (agentUser) {
        const agentName = `${agentUser.name} ${agentUser.surname}`.trim()
        setGeranceAgentLabel(geranceName ? `${agentName} (${geranceName})` : agentName)
      } else {
        setGeranceAgentLabel(geranceName || null)
      }
    })
    return () => {
      cancelled = true
    }
  }, [geranceRef?.geranceId, geranceRef?.serviceType, geranceRef?.agentUid])

  const residenceName = selectedResidence?.name ?? "Choisir une résidence"
  // Mémoïsé : référencé comme dépendance de l'aperçu live ci-dessous, un
  // nouveau tableau à chaque rendu (.filter()) redéclencherait la
  // résolution de l'image en boucle sans ça.
  const residenceContacts = useMemo(
    () => contacts.filter((c) => selectedResidence?.contactRefs?.[c.id]),
    [contacts, selectedResidence]
  )

  // Aperçu live de la photo pendant la saisie (avant même d'enregistrer) -
  // recalculé à chaque changement de prestataire, même résolution que
  // handleSubmit (resolvePrestaImage) pour ne jamais diverger.
  useEffect(() => {
    if (!prestaName) {
      setPathImage(initial?.pathImage ?? "")
      return
    }
    let cancelled = false
    resolvePrestaImage(prestaName, geranceAgentLabel, residenceContacts, initial?.pathImage ?? "").then(
      (url) => {
        if (!cancelled) setPathImage(url)
      }
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prestaName, geranceAgentLabel, residenceContacts, initial?.pathImage])

  const selectedStructure = structures.find((s) => structureLabel(s) === locationElement)
  const floorOptions = selectedStructure?.etage ?? []
  // Tant qu'aucune résidence n'est choisie (hors édition, où elle est
  // verrouillée), le reste du formulaire n'a pas de contacts à proposer et
  // n'a pas de sens à remplir avant ce choix. readOnly (intervention déjà
  // reportée) verrouille les mêmes champs, pour la raison inverse : ils ont
  // une valeur mais elle est obsolète.
  const restDisabled = (!lockResidence && !residenceId) || readOnly

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!residenceId) {
      toast.error("Choisissez une résidence")
      return
    }
    if (!eventDateOnly) {
      toast.error("Choisissez une date")
      return
    }
    if (!prestaName) {
      toast.error("Choisissez un prestataire")
      return
    }
    setSubmitting(true)
    try {
      // L'heure est optionnelle - minuit par défaut si non renseignée,
      // plutôt que de bloquer la soumission tant qu'elle est vide.
      const eventDate = new Date(`${eventDateOnly}T${eventTime || "00:00"}`)
      // pathImage vient de l'aperçu live (déjà résolu par le même
      // resolvePrestaImage à chaque changement de prestaName, cf. useEffect
      // ci-dessus) - jamais recalculé ici, pour ne jamais diverger de ce que
      // l'utilisateur a vu à l'écran avant de valider.
      await onSubmit(residenceId, {
        title: eventTitle,
        description,
        eventDate,
        prestaName,
        pathImage,
        locationElement,
        locationFloor,
        ...(linkedSinistreId ? { linkedSinistreId } : {}),
      })
    } catch (err) {
      toast.error("Échec de l'enregistrement : " + (err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel(scope: "single" | "chain") {
    if (!onCancel) return
    setCancelling(true)
    try {
      await onCancel(scope)
    } catch (err) {
      toast.error("Échec de l'annulation : " + (err as Error).message)
    } finally {
      setCancelling(false)
      setConfirmingCancel(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4 p-[3px]">
      <DialogHeader className="pb-4">
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden pr-4 pl-1">
        <div className="flex flex-col gap-2">
          <Label>Résidence</Label>
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={lockResidence}
              className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
            >
              {residenceName}
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuRadioGroup value={residenceId} onValueChange={setResidenceId}>
                <DropdownMenuLabel>Résidence</DropdownMenuLabel>
                {residences.map((r) => (
                  <DropdownMenuRadioItem key={r.id} value={r.id}>
                    {r.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className={cn("flex flex-col gap-6", restDisabled && "pointer-events-none opacity-50")}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="event-title">Titre</Label>
            <Input
              id="event-title"
              required
              disabled={restDisabled}
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-date">Date</Label>
              <DateInput value={eventDateOnly} onChange={setEventDateOnly} className="w-full" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-time">Heure (optionnel)</Label>
              <Input
                id="event-time"
                type="time"
                disabled={restDisabled}
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="event-presta">Prestataire</Label>
              {pathImage && (
                <img
                  src={pathImage}
                  alt=""
                  className="size-6 shrink-0 rounded-full border object-cover"
                />
              )}
            </div>
            <select
              id="event-presta"
              required
              disabled={restDisabled}
              value={prestaName}
              onChange={(e) => setPrestaName(e.target.value)}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="" disabled>
                Choisir un prestataire
              </option>
              {geranceAgentLabel && (
                <optgroup label="Gérance">
                  <option value={geranceAgentLabel}>{geranceAgentLabel}</option>
                </optgroup>
              )}
              <optgroup label="Contacts de la résidence">
                {residenceContacts.length === 0 && (
                  <option disabled>Aucun contact pour cette résidence</option>
                )}
                {residenceContacts.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-batiment">Bâtiment (optionnel)</Label>
              <select
                // Force un remontage à chaque fois que l'ensemble d'options
                // change réellement (structures chargées après coup depuis
                // Firestore, ou changement de résidence) : sans ça, un
                // <select> dont la defaultValue ne correspond encore à
                // aucune <option> au premier rendu ne se resélectionne pas
                // tout seul une fois l'option disponible.
                key={structures.map((s) => s.id).join(",")}
                id="event-batiment"
                disabled={restDisabled}
                defaultValue={locationElement}
                onChange={(e) => {
                  setLocationElement(e.target.value)
                  setLocationFloor("")
                }}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Non précisé</option>
                {structures.map((s) => (
                  <option key={s.id} value={structureLabel(s)}>
                    {structureLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-etage">Étage (optionnel)</Label>
              <select
                // Idem : remonte à chaque changement de bâtiment (donc de
                // liste d'étages) pour resélectionner correctement.
                key={`${locationElement}|${floorOptions.join(",")}`}
                id="event-etage"
                disabled={restDisabled || floorOptions.length === 0}
                defaultValue={locationFloor}
                onChange={(e) => setLocationFloor(e.target.value)}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
              >
                <option value="">Non précisé</option>
                {floorOptions.map((etage) => (
                  <option key={etage} value={etage}>
                    {etage}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="event-desc">Description</Label>
            <textarea
              id="event-desc"
              rows={4}
              disabled={restDisabled}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
        </div>
      </div>

      {confirmingCancel ? (
        <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
          <p>
            Souhaitez-vous annuler cette intervention, ou toutes les interventions liées
            (reprogrammations précédentes) ?
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={cancelling}
              onClick={() => setConfirmingCancel(false)}
            >
              Retour
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={cancelling}
              onClick={() => handleCancel("single")}
              className="border-red-200 text-red-700 hover:bg-red-50"
            >
              Cette intervention
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={cancelling}
              onClick={() => handleCancel("chain")}
              className="bg-red-600 hover:bg-red-700"
            >
              Toutes les interventions liées
            </Button>
          </div>
        </div>
      ) : (
        <DialogFooter>
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              disabled={submitting || cancelling}
              onClick={() => setConfirmingCancel(true)}
              className="mr-auto border-red-200 text-red-700 hover:bg-red-50"
            >
              <Ban />
              Annuler l'intervention
            </Button>
          )}
          {!readOnly && (
            <Button type="submit" disabled={submitting || cancelling}>
              <Save />
              Enregistrer
            </Button>
          )}
        </DialogFooter>
      )}
    </form>
  )
}
