import { useEffect, useState, type FormEvent } from "react"
import { ChevronDown, Save } from "lucide-react"
import { doc, getDoc } from "firebase/firestore"
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
import { db } from "@/firebase"
import { GERANCE_PLACEHOLDER_LOGO_URL, type EventInput } from "@/lib/events"
import { subscribeToContacts } from "@/lib/contacts"
import { CONTACT_SERVICE_ICON_URLS, type Contact } from "@/types/contact"
import type { GeranceRef } from "@/types/residence"
import type { Agent, ServiceType } from "@/types/gerance"
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

export function EventFormDialog({
  open,
  onOpenChange,
  title,
  residences,
  initialResidenceId,
  lockResidence,
  initial,
  linkedSinistreId,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  residences: ResidenceOption[]
  initialResidenceId?: string
  lockResidence?: boolean
  initial?: EventInput
  // Non éditable dans ce formulaire - fourni uniquement par le CTA "Programmer
  // une intervention" de SinistreDetailPage, pour lier l'intervention créée
  // au ticket d'origine.
  linkedSinistreId?: string
  onSubmit: (residenceId: string, input: EventInput) => Promise<void>
}) {
  const [residenceId, setResidenceId] = useState(initialResidenceId ?? "")
  const [eventTitle, setEventTitle] = useState(initial?.title ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [eventDateOnly, setEventDateOnly] = useState(
    initial?.eventDate ? dateToLocalParts(initial.eventDate).dateOnly : ""
  )
  const [eventTime, setEventTime] = useState(
    initial?.eventDate ? dateToLocalParts(initial.eventDate).time : ""
  )
  const [prestaName, setPrestaName] = useState(initial?.prestaName ?? "")
  const [submitting, setSubmitting] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [geranceAgentLabel, setGeranceAgentLabel] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setResidenceId(initialResidenceId ?? "")
      setEventTitle(initial?.title ?? "")
      setDescription(initial?.description ?? "")
      setEventDateOnly(initial?.eventDate ? dateToLocalParts(initial.eventDate).dateOnly : "")
      setEventTime(initial?.eventDate ? dateToLocalParts(initial.eventDate).time : "")
      setPrestaName(initial?.prestaName ?? "")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, initialResidenceId])

  useEffect(() => {
    if (!open) return
    return subscribeToContacts(setContacts, () => {
      toast.error("Impossible de charger les contacts")
    })
  }, [open])

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
    getDoc(doc(db, "gerances", geranceRef.geranceId)).then((snap) => {
      if (cancelled || !snap.exists()) return
      const data = snap.data()
      const services = (data.services as Record<ServiceType, { agents?: Agent[] } | undefined>) ?? {}
      const agents = services[geranceRef.serviceType]?.agents ?? []
      const agent = geranceRef.agentMail ? agents.find((a) => a.mail === geranceRef.agentMail) : undefined
      const geranceName = (data.name as string) ?? ""
      if (agent) {
        const agentName = `${agent.name_agent} ${agent.surname_agent}`.trim()
        setGeranceAgentLabel(geranceName ? `${agentName} (${geranceName})` : agentName)
      } else {
        setGeranceAgentLabel(geranceName || null)
      }
    })
    return () => {
      cancelled = true
    }
  }, [geranceRef?.geranceId, geranceRef?.serviceType, geranceRef?.agentMail])

  const residenceName = selectedResidence?.name ?? "Choisir une résidence"
  const residenceContacts = contacts.filter((c) => selectedResidence?.contactRefs?.[c.id])
  // Tant qu'aucune résidence n'est choisie (hors édition, où elle est
  // verrouillée), le reste du formulaire n'a pas de contacts à proposer et
  // n'a pas de sens à remplir avant ce choix.
  const restDisabled = !lockResidence && !residenceId

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
    setSubmitting(true)
    try {
      // L'heure est optionnelle - minuit par défaut si non renseignée,
      // plutôt que de bloquer la soumission tant qu'elle est vide.
      const eventDate = new Date(`${eventDateOnly}T${eventTime || "00:00"}`)
      // Photo de l'intervention résolue depuis le prestataire choisi : le
      // placeholder gérance (en attendant une vraie photo de profil par
      // gérance), ou l'icône du service du contact - vide si aucun des deux
      // ne matche (l'app affiche alors son placeholder générique).
      const isGeranceSelected = !!geranceAgentLabel && prestaName === geranceAgentLabel
      const selectedContact = residenceContacts.find((c) => c.name === prestaName)
      const pathImage = isGeranceSelected
        ? GERANCE_PLACEHOLDER_LOGO_URL
        : selectedContact
          ? (CONTACT_SERVICE_ICON_URLS[selectedContact.service as keyof typeof CONTACT_SERVICE_ICON_URLS] ?? "")
          : ""

      await onSubmit(residenceId, {
        title: eventTitle,
        description,
        eventDate,
        prestaName,
        pathImage,
        ...(linkedSinistreId ? { linkedSinistreId } : {}),
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
                <Label htmlFor="event-presta">Prestataire</Label>
                <select
                  id="event-presta"
                  disabled={restDisabled}
                  value={prestaName}
                  onChange={(e) => setPrestaName(e.target.value)}
                  className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">Aucun prestataire</option>
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
