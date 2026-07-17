import { useEffect, useState, type FormEvent } from "react"
import { ChevronDown, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import type { EventInput } from "@/lib/events"

// Seuls id/name sont utilisés ici (sélecteur de résidence) - un type minimal
// évite d'imposer le modèle Residence complet à l'appelant (ex: la fiche
// détail n'a que id + nom de résidence sous la main, pas l'adresse).
type ResidenceOption = { id: string; name: string }

// <input type="datetime-local"> attend/produit une chaîne locale sans fuseau
// ("aaaa-mm-jjThh:mm") - conversion aller-retour avec Date en heure locale du
// navigateur (l'utilisateur BO est en France, donc Europe/Paris en pratique).
function dateToLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function EventFormDialog({
  open,
  onOpenChange,
  title,
  residences,
  initialResidenceId,
  lockResidence,
  initial,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  residences: ResidenceOption[]
  initialResidenceId?: string
  lockResidence?: boolean
  initial?: EventInput
  onSubmit: (residenceId: string, input: EventInput) => Promise<void>
}) {
  const [residenceId, setResidenceId] = useState(initialResidenceId ?? "")
  const [eventTitle, setEventTitle] = useState(initial?.title ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [eventDate, setEventDate] = useState(
    initial?.eventDate ? dateToLocalInputValue(initial.eventDate) : ""
  )
  const [prestaName, setPrestaName] = useState(initial?.prestaName ?? "")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setResidenceId(initialResidenceId ?? "")
      setEventTitle(initial?.title ?? "")
      setDescription(initial?.description ?? "")
      setEventDate(initial?.eventDate ? dateToLocalInputValue(initial.eventDate) : "")
      setPrestaName(initial?.prestaName ?? "")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, initialResidenceId])

  const residenceName = residences.find((r) => r.id === residenceId)?.name ?? "Choisir une résidence"

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!residenceId) {
      toast.error("Choisissez une résidence")
      return
    }
    if (!eventDate) {
      toast.error("Choisissez une date")
      return
    }
    setSubmitting(true)
    try {
      await onSubmit(residenceId, {
        title: eventTitle,
        description,
        eventDate: new Date(eventDate),
        prestaName,
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
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-4">
            <div className="flex flex-col gap-1.5">
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-title">Titre</Label>
              <Input
                id="event-title"
                required
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-date">Date et heure</Label>
              <Input
                id="event-date"
                type="datetime-local"
                required
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-presta">Prestataire</Label>
              <Input
                id="event-presta"
                value={prestaName}
                onChange={(e) => setPrestaName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-desc">Description</Label>
              <textarea
                id="event-desc"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
