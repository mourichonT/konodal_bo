import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { ImagePlus, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PRIMARY_CTA_CLASS } from "@/lib/utils"
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
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={handleSubmit} className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4">
          <DialogHeader className="border-b border-[oklch(95%_0.003_100)] pb-4">
            <span className="text-[11.5px] font-bold tracking-wide text-primary uppercase">Publicité</span>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-4 pl-[5px]">
            <div className="grid grid-cols-[1.3fr_1fr] gap-3.5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ad-name">Nom de la campagne</Label>
                <Input
                  id="ad-name"
                  required
                  placeholder="Ex : Promo été 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ad-url">
                  Lien cible <span className="font-medium text-muted-foreground">(optionnel)</span>
                </Label>
                <Input
                  id="ad-url"
                  type="url"
                  placeholder="https://…"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ad-image">
                Image <span className="font-medium text-muted-foreground">(format carré recommandé)</span>
              </Label>
              <label
                htmlFor="ad-image"
                className="flex cursor-pointer flex-col items-center gap-3 rounded-[14px] border-[1.5px] border-dashed border-input p-6 text-center text-muted-foreground hover:border-primary/50 hover:bg-[oklch(98%_0.003_100)]"
              >
                <div className="flex size-[52px] shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-[oklch(93%_0.05_150)]">
                  {imageFile ? (
                    <img src={URL.createObjectURL(imageFile)} alt="" className="size-full object-cover" />
                  ) : imageUrl ? (
                    <img src={imageUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <ImagePlus className="size-5 text-[oklch(38%_0.09_155)]" />
                  )}
                </div>
                <div className="text-[12.5px] font-semibold">
                  {imageFile?.name ?? (imageUrl ? "Remplacer l'image" : "Choisir une image")}
                  <br />
                  <span className="font-medium text-muted-foreground">PNG/JPG, 2 Mo max</span>
                </div>
              </label>
              <input
                id="ad-image"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="flex flex-col gap-2 rounded-[14px] border border-[oklch(94%_0.005_100)] bg-[oklch(98%_0.003_100)] p-[14px_16px]">
              <Label>Période de diffusion</Label>
              <div className="flex items-center gap-2.5">
                <span className="text-[13px] font-semibold text-muted-foreground">Du</span>
                <DateInput value={startDate} onChange={setStartDate} />
                <span className="text-[13px] font-semibold text-muted-foreground">au</span>
                <DateInput value={endDate} onChange={setEndDate} />
              </div>
              <p className="text-xs text-muted-foreground">
                Activation et désactivation automatiques selon ces dates et le nombre de campagnes
                déjà actives sur les mêmes départements (max 3).
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[oklch(93%_0.005_100)]">
              <div className="flex items-center justify-between gap-2 border-b border-[oklch(94%_0.005_100)] bg-[oklch(98%_0.003_100)] p-[14px_18px]">
                <span className="text-[12.5px] font-bold text-[oklch(30%_0.01_150)]">
                  Résidences ciblées{" "}
                  <span className="font-medium text-muted-foreground">
                    ({targetResidenceIds.length} sélectionnée{targetResidenceIds.length > 1 ? "s" : ""})
                  </span>
                </span>
                <label className="flex items-center gap-1.5 text-[12.5px] font-bold text-primary">
                  <input
                    type="checkbox"
                    checked={residences.length > 0 && targetResidenceIds.length === residences.length}
                    onChange={(e) => toggleGroup(residences, e.target.checked)}
                    className="size-[17px] rounded border-input accent-primary"
                  />
                  France entière
                </label>
              </div>
              <div className="flex max-h-72 flex-col gap-1 overflow-y-auto p-1.5">
                {residences.length === 0 && (
                  <p className="px-1 py-1 text-sm text-muted-foreground">Aucune résidence.</p>
                )}
                {groupResidencesByDepartment(residences).map(([code, group]) => {
                  const allSelected = group.every((r) => targetResidenceIds.includes(r.id))
                  return (
                    <div key={code} className="flex flex-col gap-0.5">
                      <label className="flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] font-bold hover:bg-[oklch(97%_0.005_100)]">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={(e) => toggleGroup(group, e.target.checked)}
                          className="size-[17px] rounded border-input accent-primary"
                        />
                        {departmentLabel(code)}{" "}
                        <span className="font-medium text-muted-foreground">({group.length})</span>
                      </label>
                      <div className="flex flex-col gap-0.5 pl-[22px]">
                        {group.map((residence) => (
                          <label
                            key={residence.id}
                            className="flex items-center gap-2.5 rounded-[10px] px-3 py-1.5 text-[12.5px] font-semibold hover:bg-[oklch(97%_0.005_100)]"
                          >
                            <input
                              type="checkbox"
                              checked={targetResidenceIds.includes(residence.id)}
                              onChange={(e) => toggleResidence(residence.id, e.target.checked)}
                              className="size-[17px] rounded border-input accent-primary"
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
