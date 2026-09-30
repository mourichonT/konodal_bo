import { useState } from "react"
import { Eye, ImageOff, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useSinistreMedia } from "@/hooks/useSinistreMedia"

// Vignette cliquable ouvrant l'original en overlay (Dialog), pas dans un
// nouvel onglet : une pièce d'identité ou un justificatif de lot se vérifie
// sans quitter la fiche en cours d'examen. Un PDF (justificatif de
// domicile, bail...) est rendu dans une <iframe> - aperçu de la première
// page en vignette, document complet dans le Dialog.
export function DocumentThumbnail({ path, label }: { path: string; label: string }) {
  const state = useSinistreMedia(path)
  const url = state.status === "ready" ? state.url : undefined
  const isPdf = state.status === "ready" && state.isPdf
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        disabled={!url}
        onClick={() => setOpen(true)}
        className="flex max-w-64 flex-col items-center gap-1.5 disabled:cursor-default"
      >
        {state.status === "ready" && !state.isVideo && !state.isPdf ? (
          // Pas de hauteur fixée ni object-cover : la vignette suit le ratio
          // réel du document (portrait ou paysage selon la pièce déposée)
          // plutôt que de le rogner dans une boîte imposée. Pas de w-full non
          // plus : sans ça l'image s'étirerait jusqu'au plafond max-w-64 même
          // sur un document naturellement plus étroit, au lieu de rester à sa
          // taille réelle et centrée (cf. items-center sur les parents).
          <img src={state.url} alt={label} className="max-w-full rounded-lg border" />
        ) : isPdf ? (
          // pointer-events-none : le clic doit atteindre le <button> (ouverture
          // du Dialog), pas le viewer PDF embarqué.
          <iframe
            src={`${url}#toolbar=0&navpanes=0&view=FitH`}
            title={label}
            className="pointer-events-none h-72 w-52 rounded-lg border bg-white"
          />
        ) : (
          <div className="flex h-40 w-64 items-center justify-center overflow-hidden rounded-lg border bg-muted">
            {state.status === "loading" && <div className="size-full animate-pulse" />}
            {state.status === "error" && <ImageOff className="size-5 text-muted-foreground" />}
            {state.status === "ready" && state.isVideo && <Play className="size-5 text-muted-foreground" />}
          </div>
        )}
        <span className="text-xs text-muted-foreground">{label}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader className="pb-4">
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          {url &&
            (state.status === "ready" && state.isVideo ? (
              <video
                src={url}
                controls
                className="max-h-[75vh] w-full rounded-lg bg-black object-contain"
              />
            ) : isPdf ? (
              <iframe src={url} title={label} className="h-[75vh] w-full rounded-lg border" />
            ) : (
              <img src={url} alt={label} className="max-h-[75vh] w-full rounded-lg object-contain" />
            ))}
          {url && (
            <DialogFooter>
              <Button variant="outline" size="sm" render={<a href={url} target="_blank" rel="noreferrer" />}>
                <Eye />
                Ouvrir dans un onglet
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
