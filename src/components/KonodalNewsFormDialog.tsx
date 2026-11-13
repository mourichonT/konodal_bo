import { useEffect, useMemo, useState, type FormEvent } from "react"
import { BadgeCheck, BellRing, ImagePlus, Save, Send, TriangleAlert, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DescriptionTextarea } from "@/components/DescriptionTextarea"
import { useAuth } from "@/lib/auth-context"
import { PRIMARY_CTA_CLASS } from "@/lib/utils"
import {
  isMovFile,
  isValidCtaUrl,
  KONODAL_NEWS_PHOTO_TYPES,
  KONODAL_NEWS_TITLE_MAX,
  KONODAL_NEWS_VIDEO_TYPES,
  konodalNewsMediaError,
  saveKonodalNews,
  type KonodalNews,
} from "@/lib/konodalNews"
import logoKWhite from "@/assets/logo-k-white.png"

// news : message à modifier, null pour un nouveau. Contenu monté seulement
// quand la modale est ouverte (formulaire vierge à chaque ouverture).
export function KonodalNewsFormDialog({
  open,
  news,
  onOpenChange,
}: {
  open: boolean
  news: KonodalNews | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        {open && <KonodalNewsForm key={news?.id ?? "new"} news={news} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function KonodalNewsForm({ news, onDone }: { news: KonodalNews | null; onDone: () => void }) {
  const { user } = useAuth()
  const [title, setTitle] = useState(news?.title ?? "")
  const [body, setBody] = useState(news?.body ?? "")
  // File : nouveau média ; null : média retiré ; undefined : média actuel.
  const [media, setMedia] = useState<File | null | undefined>(undefined)
  const [ctaLabel, setCtaLabel] = useState(news?.ctaLabel ?? "")
  const [ctaUrl, setCtaUrl] = useState(news?.ctaUrl ?? "")
  const [sendPush, setSendPush] = useState(news ? news.sendPush : true)
  const [confirmingPush, setConfirmingPush] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)

  const published = news?.published === true
  // Push envoyée au plus une fois, à la première publication.
  const pushLocked = !!news?.publishedAt

  const fileUrl = useMemo(() => (media ? URL.createObjectURL(media) : null), [media])
  useEffect(
    () => () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl)
    },
    [fileUrl]
  )
  const mediaUrl = media === undefined ? (news?.pathImage ?? null) : fileUrl
  const mediaIsVideo = media === undefined ? news?.isVideo === true : !!media?.type.startsWith("video/")

  function handleMediaSelected(file: File | undefined) {
    if (!file) return
    const error = konodalNewsMediaError(file)
    if (error) {
      toast.error(error)
      return
    }
    setMedia(file)
  }

  function validationError(): string | null {
    if (!title.trim()) return "Le titre est obligatoire"
    if (!body.trim()) return "Le texte est obligatoire"
    const label = ctaLabel.trim()
    const url = ctaUrl.trim()
    if (!!label !== !!url) return "Renseignez le texte et le lien du bouton, ou aucun des deux"
    if (url && !isValidCtaUrl(url)) return "Le lien du bouton doit commencer par http:// ou https://"
    return null
  }

  async function save(publish: boolean) {
    if (!user) return
    setSubmitting(true)
    setProgress(media ? 0 : null)
    try {
      await saveKonodalNews(
        user.uid,
        news,
        { title, body, media, ctaLabel, ctaUrl, sendPush },
        publish,
        (ratio) => setProgress(ratio)
      )
      toast.success(
        !publish
          ? "Brouillon enregistré"
          : published
            ? "Message modifié"
            : sendPush && !pushLocked
              ? "Message publié, notification en cours d'envoi"
              : "Message publié"
      )
      onDone()
    } catch (err) {
      toast.error("Échec de l'enregistrement : " + (err as Error).message)
      setConfirmingPush(false)
    } finally {
      setSubmitting(false)
      setProgress(null)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const error = validationError()
    if (error) {
      toast.error(error)
      return
    }
    // Première publication avec push : confirmation, la push ne se rattrape pas.
    if (!published && sendPush && !pushLocked && !confirmingPush) {
      setConfirmingPush(true)
      return
    }
    void save(true)
  }

  function handleSaveDraft() {
    const error = validationError()
    if (error) {
      toast.error(error)
      return
    }
    void save(false)
  }

  const showCta = !!ctaLabel.trim() && isValidCtaUrl(ctaUrl)

  return (
    <form onSubmit={handleSubmit} className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4 p-[3px]">
      <DialogHeader className="border-b border-[oklch(95%_0.003_100)] pb-4">
        <span className="text-[11.5px] font-bold tracking-wide text-primary uppercase">Chat Konodal</span>
        <DialogTitle>{news ? "Modifier le message" : "Nouveau message"}</DialogTitle>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 gap-6 overflow-x-hidden overflow-y-auto pr-4 pl-[5px]">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="konodal-news-title">Titre</Label>
            <Input
              id="konodal-news-title"
              required
              maxLength={KONODAL_NEWS_TITLE_MAX}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              Titre de la bulle, aperçu dans la liste des conversations et texte de la notification.
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="konodal-news-body">Texte</Label>
            <DescriptionTextarea id="konodal-news-body" required rows={5} value={body} onChange={setBody} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="konodal-news-media">Photo ou vidéo (optionnel)</Label>
            {mediaUrl ? (
              <div className="flex items-center gap-3 rounded-[14px] border border-[oklch(93%_0.005_100)] p-3">
                {mediaIsVideo ? (
                  <video src={mediaUrl} muted className="size-16 shrink-0 rounded-[10px] bg-black object-cover" />
                ) : (
                  <img src={mediaUrl} alt="" className="size-16 shrink-0 rounded-[10px] object-cover" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm">
                  {media ? media.name : mediaIsVideo ? "Vidéo actuelle" : "Photo actuelle"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={submitting}
                  onClick={() => setMedia(null)}
                  aria-label="Retirer le média"
                  title="Retirer le média"
                >
                  <X />
                </Button>
              </div>
            ) : (
              <label
                htmlFor="konodal-news-media"
                className="flex cursor-pointer items-center gap-3 rounded-[14px] border-[1.5px] border-dashed border-input p-4 text-muted-foreground hover:border-primary/50 hover:bg-[oklch(98%_0.003_100)]"
              >
                <div className="flex size-[44px] shrink-0 items-center justify-center rounded-[12px] bg-[oklch(93%_0.05_150)]">
                  <ImagePlus className="size-5 text-[oklch(38%_0.09_155)]" />
                </div>
                <div className="text-[12.5px] font-semibold">
                  Ajouter une photo ou une vidéo
                  <br />
                  <span className="font-medium text-muted-foreground">
                    Photo JPG, PNG, WebP ou GIF (10 Mo) ; vidéo MP4 ou MOV (100 Mo)
                  </span>
                </div>
              </label>
            )}
            {media && isMovFile(media) && (
              <p className="flex items-start gap-1.5 text-xs text-[oklch(50%_0.13_70)]">
                <TriangleAlert className="mt-px size-3.5 shrink-0" />
                Une vidéo MOV filmée sur iPhone est souvent en HEVC : elle ne se lit alors ni sur Android ni dans la
                webapp. Préférez un MP4 (H.264).
              </p>
            )}
            <input
              id="konodal-news-media"
              type="file"
              accept={[...KONODAL_NEWS_PHOTO_TYPES, ...KONODAL_NEWS_VIDEO_TYPES].join(",")}
              className="hidden"
              onChange={(e) => {
                handleMediaSelected(e.target.files?.[0])
                e.target.value = ""
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Bouton (optionnel)</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                aria-label="Texte du bouton"
                placeholder="Texte du bouton, ex. Découvrir"
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                className="sm:w-48"
              />
              <Input
                aria-label="Lien du bouton"
                type="url"
                placeholder="https://…"
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                className="flex-1"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              Le bouton n'apparaît que si le texte et le lien sont renseignés.
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Notification</Label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={sendPush}
                disabled={pushLocked || submitting}
                onChange={(e) => setSendPush(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
              />
              <span>
                Envoyer une notification « Konodal » à tous les comptes résidents à la publication
                {pushLocked && (
                  <span className="block text-xs text-muted-foreground">
                    {news?.pushSentAt
                      ? "Notification déjà envoyée : elle ne part qu'une fois."
                      : "Ne se modifie plus après la première publication."}
                  </span>
                )}
              </span>
            </label>
          </div>
        </div>

        <div className="hidden w-72 shrink-0 flex-col gap-2 md:flex">
          <Label>Aperçu dans l'app</Label>
          <div className="flex flex-col gap-3 rounded-[18px] bg-[oklch(96%_0.005_100)] p-3">
            <div className="flex items-center gap-2">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[oklch(45%_0.1_155)]">
                <img src={logoKWhite} alt="" className="size-4.5 object-contain" />
              </div>
              <span className="text-sm font-bold">Konodal</span>
              <BadgeCheck className="size-4 text-[oklch(55%_0.15_240)]" aria-label="Compte vérifié" />
            </div>
            <div className="flex flex-col gap-2 overflow-hidden rounded-[14px] rounded-tl-[4px] bg-white p-2.5 shadow-[0_1px_2px_oklch(20%_0_0/0.06)]">
              {mediaUrl &&
                (mediaIsVideo ? (
                  <video src={mediaUrl} controls muted className="w-full rounded-[10px] bg-black" />
                ) : (
                  <img src={mediaUrl} alt="" className="w-full rounded-[10px] object-cover" />
                ))}
              <span className="text-sm font-bold break-words">{title.trim() || "Titre du message"}</span>
              <span className="text-[13px] break-words whitespace-pre-line text-[oklch(35%_0.01_150)]">
                {body.trim() || "Texte du message"}
              </span>
              {showCta && (
                <span className="rounded-[10px] border border-[oklch(45%_0.1_155)] py-1.5 text-center text-[13px] font-semibold text-[oklch(38%_0.09_155)]">
                  {ctaLabel.trim()}
                </span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground">Lecture seule : les résidents ne peuvent pas répondre.</span>
          </div>
        </div>
      </div>

      {confirmingPush ? (
        <div className="flex flex-col gap-3 rounded-[14px] bg-[oklch(96%_0.03_75)] p-3 sm:flex-row sm:items-center">
          <p className="flex flex-1 items-start gap-2 text-sm">
            <BellRing className="mt-0.5 size-4 shrink-0 text-[oklch(50%_0.13_70)]" />
            Une notification partira vers tous les comptes résidents. Elle ne pourra pas être annulée.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setConfirmingPush(false)}>
              Retour
            </Button>
            <Button type="submit" disabled={submitting} className={PRIMARY_CTA_CLASS}>
              <Send />
              {submitting ? progressLabel(progress, "Publication…") : "Publier et notifier"}
            </Button>
          </div>
        </div>
      ) : (
        <DialogFooter>
          {published && (
            <span className="mr-auto self-center text-xs text-muted-foreground">
              Message publié : la modification s'affiche tout de suite chez tous les résidents.
            </span>
          )}
          <Button type="button" variant="outline" onClick={onDone}>
            Annuler
          </Button>
          {!published && (
            <Button type="button" variant="outline" disabled={submitting} onClick={handleSaveDraft}>
              <Save />
              Enregistrer le brouillon
            </Button>
          )}
          <Button type="submit" disabled={submitting} className={PRIMARY_CTA_CLASS}>
            {published ? <Save /> : <Send />}
            {submitting
              ? progressLabel(progress, published ? "Enregistrement…" : "Publication…")
              : published
                ? "Enregistrer"
                : "Publier"}
          </Button>
        </DialogFooter>
      )}
    </form>
  )
}

// Pendant l'envoi d'un média : pourcentage envoyé.
function progressLabel(progress: number | null, fallback: string): string {
  return progress !== null && progress < 1 ? `Envoi du média… ${Math.round(progress * 100)} %` : fallback
}
