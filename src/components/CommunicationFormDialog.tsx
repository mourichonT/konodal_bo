import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { CalendarClock, ImagePlus, Save, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PRIMARY_CTA_CLASS } from "@/lib/utils"
import { DescriptionTextarea } from "@/components/DescriptionTextarea"
import {
  COMMUNICATION_PHOTO_MAX_BYTES,
  COMMUNICATION_PHOTO_TYPES,
  type CommunicationInput,
} from "@/lib/communications"
import { fetchLinkPreview } from "@/lib/linkPreview"
import { PublishAtFields } from "@/components/PublishAtFields"
import { formatPublishAt, nextFullHour, publishAtError, toDateField, toPublishAt, toTimeField } from "@/lib/publishAt"
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
  // résidence sélectionnée. publishAt : publication programmée (null =
  // maintenant).
  onSubmit: (residenceId: string, input: CommunicationInput, publishAt: Date | null) => Promise<void>
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
  onSubmit: (residenceId: string, input: CommunicationInput, publishAt: Date | null) => Promise<void>
  onDone: () => void
}) {
  const [selectedResidenceIds, setSelectedResidenceIds] = useState<Set<string>>(new Set())
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [link, setLink] = useState("")
  const [audience, setAudience] = useState<CommunicationAudience>("all")
  const [photo, setPhoto] = useState<File | null>(null)
  // Publication programmée : date et heure locales, prochaine heure pleine
  // par défaut.
  const [scheduled, setScheduled] = useState(false)
  const [publishDate, setPublishDate] = useState(() => toDateField(nextFullHour()))
  const [publishTime, setPublishTime] = useState(() => toTimeField(nextFullHour()))
  const [submitting, setSubmitting] = useState(false)

  const photoPreview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo])
  useEffect(
    () => () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview)
    },
    [photoPreview]
  )

  function handlePhotoSelected(file: File | undefined) {
    if (!file) return
    if (!COMMUNICATION_PHOTO_TYPES.includes(file.type)) {
      toast.error("Format non pris en charge : JPG, PNG, WebP ou GIF")
      return
    }
    if (file.size > COMMUNICATION_PHOTO_MAX_BYTES) {
      toast.error("Photo trop lourde : 10 Mo maximum")
      return
    }
    setPhoto(file)
  }

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
    const publishAt = scheduled ? toPublishAt(publishDate, publishTime) : null
    const scheduleError = scheduled ? publishAtError(publishAt) : null
    if (scheduleError) {
      toast.error(scheduleError)
      return
    }
    setSubmitting(true)
    try {
      // Résolu une seule fois pour toute la soumission (partagé par toutes
      // les copies) - une URL invalide/inaccessible bloque la publication
      // plutôt que d'enregistrer un lien resté vide (cf. fetchLinkPreview).
      const linkPreview = link.trim() ? await fetchLinkPreview(link) : undefined
      // Un seul groupId pour toute la soumission, quel que soit le nombre de
      // résidences cochées - permet de regrouper les copies dans la liste BO
      // (cf. Communication.groupId).
      const input: CommunicationInput = {
        title,
        description,
        audience,
        groupId: crypto.randomUUID(),
        link: linkPreview,
        photo: photo ?? undefined,
      }
      await Promise.all([...selectedResidenceIds].map((residenceId) => onSubmit(residenceId, input, publishAt)))
      toast.success(publishAt ? `Communication programmée le ${formatPublishAt(publishAt)}` : "Communication publiée")
      onDone()
    } catch (err) {
      toast.error("Échec de l'enregistrement : " + (err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4 p-[3px]">
      <DialogHeader className="border-b border-[oklch(95%_0.003_100)] pb-4">
        <span className="text-[11.5px] font-bold tracking-wide text-primary uppercase">Communication</span>
        <DialogTitle>Communiquer</DialogTitle>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 gap-6 overflow-y-auto overflow-x-hidden pr-4 pl-[5px]">
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
            <DescriptionTextarea
              id="communication-description"
              required
              rows={5}
              value={description}
              onChange={setDescription}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="communication-link">Lien (optionnel)</Label>
            <Input
              id="communication-link"
              type="url"
              placeholder="https://…"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
          </div>
          {/* Une photo, comme dans l'app (affichée sous le texte). Pas de
              vidéo : l'app n'en affiche pas dans une communication. */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="communication-photo">Photo (optionnel)</Label>
            {photo && photoPreview ? (
              <div className="flex items-center gap-3 rounded-[14px] border border-[oklch(93%_0.005_100)] p-3">
                <img src={photoPreview} alt="" className="size-16 shrink-0 rounded-[10px] object-cover" />
                <span className="min-w-0 flex-1 truncate text-sm">{photo.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={submitting}
                  onClick={() => setPhoto(null)}
                  aria-label="Retirer la photo"
                  title="Retirer la photo"
                >
                  <X />
                </Button>
              </div>
            ) : (
              <label
                htmlFor="communication-photo"
                className="flex cursor-pointer items-center gap-3 rounded-[14px] border-[1.5px] border-dashed border-input p-4 text-muted-foreground hover:border-primary/50 hover:bg-[oklch(98%_0.003_100)]"
              >
                <div className="flex size-[44px] shrink-0 items-center justify-center rounded-[12px] bg-[oklch(93%_0.05_150)]">
                  <ImagePlus className="size-5 text-[oklch(38%_0.09_155)]" />
                </div>
                <div className="text-[12.5px] font-semibold">
                  Ajouter une photo
                  <br />
                  <span className="font-medium text-muted-foreground">JPG, PNG, WebP ou GIF, 10 Mo max</span>
                </div>
              </label>
            )}
            <input
              id="communication-photo"
              type="file"
              accept={COMMUNICATION_PHOTO_TYPES.join(",")}
              className="hidden"
              onChange={(e) => {
                handlePhotoSelected(e.target.files?.[0])
                e.target.value = ""
              }}
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
          {/* Programmée : publiée par le serveur à l'heure choisie (cf.
              scheduleCommunication), notification des résidents comprise. */}
          <div className="flex flex-col gap-2">
            <Label>Publication</Label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="communication-publication"
                  checked={!scheduled}
                  onChange={() => setScheduled(false)}
                  className="size-4 border-input accent-primary"
                />
                Maintenant
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="communication-publication"
                  checked={scheduled}
                  onChange={() => setScheduled(true)}
                  className="size-4 border-input accent-primary"
                />
                Programmer
              </label>
              {scheduled && (
                <div className="flex flex-col gap-1.5 pl-6">
                  <PublishAtFields
                    date={publishDate}
                    time={publishTime}
                    onDateChange={setPublishDate}
                    onTimeChange={setPublishTime}
                    disabled={submitting}
                  />
                  <span className="text-xs text-muted-foreground">
                    Rien n'est visible dans l'app avant cette heure ; les résidents sont notifiés à la publication.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex w-56 shrink-0 flex-col gap-2">
          <Label>Résidences ({selectedResidenceIds.size})</Label>
          <div className="flex max-h-80 flex-col overflow-y-auto rounded-[18px] border border-[oklch(93%_0.005_100)] p-[14px]">
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
                  className="size-[17px] shrink-0 rounded border-input accent-primary"
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
                    className="size-[17px] shrink-0 rounded border-input accent-primary"
                  />
                  <span className="truncate">{r.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" disabled={submitting} className={PRIMARY_CTA_CLASS}>
          {scheduled ? <CalendarClock /> : <Save />}
          {scheduled ? (submitting ? "Programmation…" : "Programmer") : submitting ? "Publication…" : "Publier"}
        </Button>
      </DialogFooter>
    </form>
  )
}
