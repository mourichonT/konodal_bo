import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { AdCampaignConfig } from "@/types/adCampaign"

export function AdCampaignConfigDialog({
  open,
  onOpenChange,
  config,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: AdCampaignConfig
  onSubmit: (displayFrequency: number) => Promise<void>
}) {
  const [displayFrequency, setDisplayFrequency] = useState(config.displayFrequency)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) setDisplayFrequency(config.displayFrequency)
  }, [open, config])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit(displayFrequency)
      onOpenChange(false)
    } catch (err) {
      toast.error("Échec de l'enregistrement : " + (err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader className="pb-4">
            <DialogTitle>Réglage global des campagnes</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ad-config-frequency">Fréquence d'affichage (tous les N posts)</Label>
            <Input
              id="ad-config-frequency"
              type="number"
              min={1}
              required
              value={displayFrequency}
              onChange={(e) => setDisplayFrequency(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Valeur commune à toutes les campagnes actives, appliquée dans le fil de l'app.
            </p>
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
