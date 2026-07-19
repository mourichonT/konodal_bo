import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { ImagePlus, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DateInput } from "@/components/DateInput"
import { uploadAdCampaignImage } from "@/lib/adCampaigns"
import { departmentLabel, groupResidencesByDepartment } from "@/lib/departments"
import type { AdCampaign, AdCampaignInput } from "@/types/adCampaign"
import type { Residence } from "@/types/residence"

export function AdCampaignFormDialog({
  open,
  onOpenChange,
  title,
  residences,
  initial,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  residences: Residence[]
  initial?: AdCampaign
  onSubmit: (input: AdCampaignInput) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [targetUrl, setTargetUrl] = useState("")
  const [targetResidenceIds, setTargetResidenceIds] = useState<string[]>([])
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "")
      setImageUrl(initial?.imageUrl ?? "")
      setImageFile(null)
      setTargetUrl(initial?.targetUrl ?? "")
      setTargetResidenceIds(initial?.targetResidenceIds ?? [])
      setStartDate(initial?.startDate ?? "")
      setEndDate(initial?.endDate ?? "")
    }
  }, [open, initial])

  function toggleResidence(id: string, checked: boolean) {
    setTargetResidenceIds((prev) => (checked ? [...prev, id] : prev.filter((r) => r !== id)))
  }

  function toggleGroup(group: Residence[], checked: boolean) {
    const groupIds = group.map((r) => r.id)
    setTargetResidenceIds((prev) =>
      checked ? [...new Set([...prev, ...groupIds])] : prev.filter((id) => !groupIds.includes(id))
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      toast.error("Le nom de la campagne est requis")
      return
    }
    if (!imageFile && !imageUrl) {
      toast.error("Une image est requise")
      return
    }
    if (targetResidenceIds.length === 0) {
      toast.error("Sélectionnez au moins une résidence")
      return
    }
    if (!startDate || !endDate) {
      toast.error("La période de diffusion (début et fin) est requise")
      return
    }
    if (endDate < startDate) {
      toast.error("La date de fin doit être après la date de début")
      return
    }
    setSubmitting(true)
    try {
      const finalImageUrl = imageFile ? await uploadAdCampaignImage(imageFile) : imageUrl
      await onSubmit({
        name: name.trim(),
        imageUrl: finalImageUrl,
        targetUrl,
        targetResidenceIds,
        startDate,
        endDate,
      })
    } catch (err) {
      toast.error("Échec de l'enregistrement : " + (err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4">
          <DialogHeader className="pb-4">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ad-name" className="p-2.5">Nom de la campagne</Label>
              <Input
                id="ad-name"
                required
                placeholder="Ex : Promo été 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ad-image" className="p-2.5">Image (format carré recommandé)</Label>
              <label
                htmlFor="ad-image"
                className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-input p-4 text-sm text-muted-foreground hover:bg-muted/50"
              >
                {imageFile ? (
                  <img
                    src={URL.createObjectURL(imageFile)}
                    alt=""
                    className="size-32 rounded-md object-cover"
                  />
                ) : imageUrl ? (
                  <img src={imageUrl} alt="" className="size-32 rounded-md object-cover" />
                ) : (
                  <ImagePlus className="size-6" />
                )}
                {imageFile?.name ?? (imageUrl ? "Remplacer l'image" : "Choisir une image")}
              </label>
              <input
                id="ad-image"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ad-url" className="p-2.5">Lien cible (optionnel)</Label>
              <Input
                id="ad-url"
                type="url"
                placeholder="https://…"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="p-2.5">Période de diffusion</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Du</span>
                <DateInput value={startDate} onChange={setStartDate} />
                <span className="text-sm text-muted-foreground">au</span>
                <DateInput value={endDate} onChange={setEndDate} />
              </div>
              <p className="text-xs text-muted-foreground">
                Activation et désactivation automatiques selon ces dates et le nombre de campagnes
                déjà actives sur les mêmes départements (max 3).
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label>
                  Résidences ciblées ({targetResidenceIds.length} sélectionnée
                  {targetResidenceIds.length > 1 ? "s" : ""})
                </Label>
                <label className="flex items-center gap-2 text-sm font-medium text-primary">
                  <input
                    type="checkbox"
                    checked={residences.length > 0 && targetResidenceIds.length === residences.length}
                    onChange={(e) => toggleGroup(residences, e.target.checked)}
                    className="size-4 rounded border-input accent-primary"
                  />
                  France entière
                </label>
              </div>
              <div className="flex max-h-72 flex-col gap-3 overflow-y-auto rounded-lg border border-input p-2">
                {residences.length === 0 && (
                  <p className="px-1 py-1 text-sm text-muted-foreground">Aucune résidence.</p>
                )}
                {groupResidencesByDepartment(residences).map(([code, group]) => {
                  const allSelected = group.every((r) => targetResidenceIds.includes(r.id))
                  return (
                    <div key={code} className="flex flex-col gap-1">
                      <label className="flex items-center gap-2 rounded-md bg-muted/40 px-1.5 py-1 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={(e) => toggleGroup(group, e.target.checked)}
                          className="size-4 rounded border-input accent-primary"
                        />
                        {departmentLabel(code)} ({group.length})
                      </label>
                      <div className="flex flex-col gap-0.5 pl-6">
                        {group.map((residence) => (
                          <label
                            key={residence.id}
                            className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted/50"
                          >
                            <input
                              type="checkbox"
                              checked={targetResidenceIds.includes(residence.id)}
                              onChange={(e) => toggleResidence(residence.id, e.target.checked)}
                              className="size-4 rounded border-input accent-primary"
                            />
                            {residence.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
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
