import { useEffect, useState, type FormEvent } from "react"
import { Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PRIMARY_CTA_CLASS } from "@/lib/utils"
import { toast } from "sonner"
import type { EmergencyContact, EmergencyContactInput } from "@/lib/emergencyContacts"

// Seules ces deux valeurs sont reconnues côté app pour choisir l'icône
// (EmergenciesContactsView._iconForService, konodal_app) - toute autre
// valeur retombe sur une icône téléphone générique.
const EMERGENCY_SERVICES = ["Urgence", "Sécurité"] as const

export function EmergencyContactFormDialog({
  open,
  onOpenChange,
  title,
  contact,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  // Présent = édition (préremplit), absent = création (vide).
  contact?: EmergencyContact | null
  onSubmit: (input: EmergencyContactInput) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [service, setService] = useState<string>(EMERGENCY_SERVICES[0])
  const [phone, setPhone] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setName(contact?.name ?? "")
      setService(contact?.service || EMERGENCY_SERVICES[0])
      setPhone(contact?.phone ?? "")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contact?.id])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit({ name, service, phone })
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
          <DialogHeader className="border-b border-[oklch(95%_0.003_100)] pb-4">
            <span className="text-[11.5px] font-bold tracking-wide text-primary uppercase">
              Numéro d'urgence
            </span>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-4 pl-[5px]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emergency-name">Nom</Label>
              <Input
                id="emergency-name"
                required
                placeholder="Police secours, SAMU, Pompiers…"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emergency-service">Catégorie</Label>
              <select
                id="emergency-service"
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {EMERGENCY_SERVICES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Détermine l'icône affichée côté app.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emergency-phone">Téléphone</Label>
              <Input
                id="emergency-phone"
                required
                placeholder="17, 15, 18, 112…"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
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
