import { useEffect, useRef, useState, type FormEvent } from "react"
import { Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
  // Une résidence choisie -> un post créé dans cette résidence (pas de post
  // partagé entre résidences côté connectkasa) - appelé une fois par
  // résidence sélectionnée.
  onSubmit: (residenceId: string, input: CommunicationInput) => Promise<void>
}

// Même patron que EventFormDialog : le contenu (et son état) n'est monté que
// quand la modale est ouverte, pour repartir d'un formulaire vierge à chaque
// ouverture sans useEffect de reset.
export function CommunicationFormDialog({ open, onOpenChange, residences, onSubmit }: CommunicationFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
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
  const [selectedResidenceIds, setSelectedResidenceIds] = useState<Set<string>>(new Set())
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [audience, setAudience] = useState<CommunicationAudience>("all")
  const [submitting, setSubmitting] = useState(false)

  function toggleResidence(id: string) {
    setSelectedResidenceIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const allSelected = residences.length > 0 && selectedResidenceIds.size === residences.length
  const someSelected = selectedResidenceIds.size > 0 && !allSelected

  // "Toutes les résidences" (case parente) : coché si tout est sélectionné,
  // indéterminé si une partie seulement - un <input type="checkbox"> ne
  // supporte l'état indéterminé que par la propriété DOM, pas un attribut
  // JSX, d'où le ref.
  const selectAllRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected
  }, [someSelected])

  function toggleAllResidences() {
    setSelectedResidenceIds(allSelected ? new Set() : new Set(residences.map((r) => r.id)))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (selectedResidenceIds.size === 0) {
      toast.error("Choisissez au moins une résidence")
      return
    }
    setSubmitting(true)
    try {
      // Un seul groupId pour toute la soumission, quel que soit le nombre de
      // résidences cochées - permet de regrouper les copies dans la liste BO
      // (cf. Communication.groupId).
      const input: CommunicationInput = { title, description, audience, groupId: crypto.randomUUID() }
      await Promise.all([...selectedResidenceIds].map((residenceId) => onSubmit(residenceId, input)))
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

      <div className="flex min-h-0 flex-1 gap-6 overflow-y-auto overflow-x-hidden pr-4 pl-1">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
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

        <div className="flex w-56 shrink-0 flex-col gap-2">
          <Label>Résidences ({selectedResidenceIds.size})</Label>
          <div className="flex max-h-80 flex-col overflow-y-auto rounded-lg border border-input p-2.5">
            {residences.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune résidence disponible.</p>
            )}
            {residences.length > 0 && (
              <label className="flex items-center gap-2 border-b pb-1.5 text-sm font-medium">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAllResidences}
                  className="size-4 shrink-0 rounded border-input accent-primary"
                />
                Toutes les résidences
              </label>
            )}
            <div className="flex flex-col gap-1.5 pt-1.5 pl-4">
              {residences.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedResidenceIds.has(r.id)}
                    onChange={() => toggleResidence(r.id)}
                    className="size-4 shrink-0 rounded border-input accent-primary"
                  />
                  <span className="truncate">{r.name}</span>
                </label>
              ))}
            </div>
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
