import { useEffect, useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { FileText, Sparkles, UploadCloud, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PRIMARY_CTA_CLASS } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import {
  createResidenceImport,
  subscribeToRecentResidenceImports,
  RESIDENCE_IMPORT_MAX_FILE_BYTES,
  type ResidenceImport,
} from "@/lib/residenceImport"
import { ImportStatusBadge } from "./ImportStatusBadge"

const MAX_FILES = 10

// « Créer avec Nodo » (superAdmin) : dépôt des PDF de la copropriété, puis
// page de l'import (lecture dans Claude, vérification, création).
export function ResidenceImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">{open && <ResidenceImportForm onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  )
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} Mo` : `${Math.ceil(bytes / 1024)} Ko`
}

function ResidenceImportForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [label, setLabel] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [progress, setProgress] = useState<number | null>(null)
  const [recent, setRecent] = useState<ResidenceImport[]>([])

  useEffect(
    () =>
      subscribeToRecentResidenceImports(setRecent, (err) =>
        console.warn("Imports récents non chargés :", err.message)
      ),
    []
  )

  function addFiles(list: FileList | null) {
    const picked = Array.from(list ?? [])
    const rejected = picked.filter(
      (f) => !(f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) || f.size > RESIDENCE_IMPORT_MAX_FILE_BYTES
    )
    if (rejected.length) toast.error(`Ignoré : ${rejected.map((f) => f.name).join(", ")} (PDF de 60 Mo au plus).`)
    setFiles((current) => [...current, ...picked.filter((f) => !rejected.includes(f))].slice(0, MAX_FILES))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!user || files.length === 0) return
    setProgress(0)
    try {
      const id = await createResidenceImport(label, files, user.uid, setProgress)
      onDone()
      navigate(`/residences/import/${id}`)
    } catch (err) {
      toast.error("Échec de l'envoi des documents : " + (err as Error).message)
      setProgress(null)
    }
  }

  const uploading = progress !== null

  return (
    <form onSubmit={handleSubmit} className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4">
      <DialogHeader className="border-b border-[oklch(95%_0.003_100)] pb-4">
        <span className="text-[11.5px] font-bold tracking-wide text-primary uppercase">Résidence</span>
        <DialogTitle>Créer avec Nodo</DialogTitle>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-4 pl-[5px]">
        <p className="text-sm text-muted-foreground">
          Déposez le règlement de copropriété et, s'il y en a, l'état descriptif de division et ses modificatifs.
          Claude les lit ensuite avec le connecteur Konodal, puis vous vérifiez la proposition avant de créer la
          résidence.
        </p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="import-label">Nom de la résidence (facultatif)</Label>
          <Input id="import-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Orion Sky" />
        </div>
        <div className="flex flex-col gap-2">
          <label
            htmlFor="import-files"
            className="flex cursor-pointer flex-col items-center gap-2 rounded-[18px] border border-dashed border-input p-4 text-center text-sm text-muted-foreground hover:bg-muted/50"
          >
            <UploadCloud className="size-6" />
            Choisir les PDF ({MAX_FILES} au plus)
          </label>
          <input
            id="import-files"
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ""
            }}
          />
          {files.map((file, i) => (
            <div key={`${file.name}-${i}`} className="flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatSize(file.size)}</span>
              {!uploading && (
                <button
                  type="button"
                  aria-label={`Retirer ${file.name}`}
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setFiles((current) => current.filter((_, j) => j !== i))}
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        {uploading && (
          <div className="flex flex-col gap-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">Envoi des documents… {Math.round((progress ?? 0) * 100)} %</p>
          </div>
        )}
        {recent.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">Imports récents</p>
            {recent.map((job) => (
              <Link
                key={job.id}
                to={`/residences/import/${job.id}`}
                onClick={onDone}
                className="flex min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50"
              >
                <span className="min-w-0 truncate">{job.label || job.files?.[0]?.name || job.id}</span>
                <ImportStatusBadge status={job.status} />
              </Link>
            ))}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={uploading}>
          Annuler
        </Button>
        <Button type="submit" disabled={files.length === 0 || uploading || !user} className={PRIMARY_CTA_CLASS}>
          <Sparkles />
          Envoyer les documents
        </Button>
      </DialogFooter>
    </form>
  )
}
