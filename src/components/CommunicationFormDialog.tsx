import { useState, type FormEvent } from "react"
import { Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SearchableSelect } from "@/components/SearchableSelect"
import type { CommunicationInput } from "@/lib/communications"
import {
  COMMUNICATION_AUDIENCES,
  communicationAudienceLabels,
  type CommunicationAudience,
} from "@/types/communication"

type ResidenceOption = { id: string; name: string }

type CommunicationFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  residences: ResidenceOption[]
  onSubmit: (residenceId: string, input: CommunicationInput) => Promise<void>
}

// Même patron que EventFormDialog : le contenu (et son état) n'est monté que
// quand la modale est ouverte, pour repartir d'un formulaire vierge à chaque
// ouverture sans useEffect de reset.
export function CommunicationFormDialog({ open, onOpenChange, residences, onSubmit }: CommunicationFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <CommunicationFormDialogContent
            residences={residences}
            onSubmit={onSubmit}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function CommunicationFormDialogContent({
  residences,
  onSubmit,
  onDone,
}: {
  residences: ResidenceOption[]
  onSubmit: (residenceId: string, input: CommunicationInput) => Promise<void>
  onDone: () => void
}) {
  const [residenceId, setResidenceId] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [audience, setAudience] = useState<CommunicationAudience>("all")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!residenceId) {
      toast.error("Choisissez une résidence")
      return
    }
    setSubmitting(true)
    try {
      await onSubmit(residenceId, { title, description, audience })
      toast.success("Communication publiée")
      onDone()
    } catch (err) {
      toast.error("Échec de l'enregistrement : " + (err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4 p-[3px]">
      <DialogHeader className="pb-4">
        <DialogTitle>Communiquer</DialogTitle>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden pr-4 pl-1">
        <div className="flex flex-col gap-2">
          <Label htmlFor="communication-residence">Résidence</Label>
          <SearchableSelect
            id="communication-residence"
            value={residenceId}
            onChange={setResidenceId}
            emptyLabel="Choisir une résidence"
            groups={[{ options: residences.map((r) => ({ value: r.id, label: r.name })) }]}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="communication-title">Titre</Label>
          <Input
            id="communication-title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="communication-description">Description</Label>
          <textarea
            id="communication-description"
            required
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Destinataires</Label>
          <div className="flex flex-col gap-2">
            {COMMUNICATION_AUDIENCES.map((value) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="communication-audience"
                  value={value}
                  checked={audience === value}
                  onChange={() => setAudience(value)}
                  className="size-4 border-input accent-primary"
                />
                {communicationAudienceLabels[value]}
              </label>
            ))}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={submitting}>
          <Save />
          Publier
        </Button>
      </DialogFooter>
    </form>
  )
}
