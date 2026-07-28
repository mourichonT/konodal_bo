import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { ChevronDown, FileUp, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PRIMARY_CTA_CLASS } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { RESIDENCE_DOCUMENT_CATEGORIES, type ResidenceDocumentInput } from "@/types/document"
import type { Residence } from "@/types/residence"

const ACCEPTED_FILE_TYPES = ".pdf,.jpg,.jpeg,.png"

export function ResidenceDocumentFormDialog({
  open,
  onOpenChange,
  residences,
  initialResidenceId,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  residences: Residence[]
  initialResidenceId?: string
  onSubmit: (residenceId: string, input: ResidenceDocumentInput) => Promise<void>
}) {
  const [residenceId, setResidenceId] = useState("")
  const [category, setCategory] = useState<string>(RESIDENCE_DOCUMENT_CATEGORIES[0])
  const [name, setName] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setResidenceId(initialResidenceId && initialResidenceId !== "all" ? initialResidenceId : "")
      setCategory(RESIDENCE_DOCUMENT_CATEGORIES[0])
      setName("")
      setFile(null)
    }
  }, [open, initialResidenceId])

  const residenceName = residences.find((r) => r.id === residenceId)?.name ?? "Choisir une résidence"

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!residenceId) {
      toast.error("Choisissez une résidence")
      return
    }
    if (!name.trim()) {
      toast.error("Le nom du document est requis")
      return
    }
    if (!file) {
      toast.error("Un fichier est requis")
      return
    }
    setSubmitting(true)
    try {
      await onSubmit(residenceId, { name: name.trim(), category, file })
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
            <span className="text-[11.5px] font-bold tracking-wide text-primary uppercase">Document</span>
            <DialogTitle>Ajouter un document de résidence</DialogTitle>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden pr-4 pl-[5px]">
            <div className="flex flex-col gap-1.5">
              <Label>Résidence</Label>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
                  {residenceName}
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72">
                  <DropdownMenuRadioGroup value={residenceId} onValueChange={setResidenceId}>
                    <DropdownMenuLabel>Résidence</DropdownMenuLabel>
                    {residences.map((r) => (
                      <DropdownMenuRadioItem key={r.id} value={r.id}>
                        {r.name}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Catégorie</Label>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
                  {category}
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72">
                  <DropdownMenuRadioGroup value={category} onValueChange={setCategory}>
                    {RESIDENCE_DOCUMENT_CATEGORIES.map((c) => (
                      <DropdownMenuRadioItem key={c} value={c}>
                        {c}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="residence-doc-name">Nom du document</Label>
              <Input
                id="residence-doc-name"
                required
                placeholder="Ex : PV d'AG du 12/03/2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="residence-doc-file">Fichier (PDF, JPG ou PNG)</Label>
              <label
                htmlFor="residence-doc-file"
                className="flex cursor-pointer flex-col items-center gap-4 rounded-[14px] border-[1.5px] border-dashed border-input p-7 text-center text-muted-foreground hover:border-primary/50 hover:bg-[oklch(98%_0.003_100)]"
              >
                <div className="flex size-[52px] shrink-0 items-center justify-center rounded-[12px] bg-[oklch(93%_0.05_150)]">
                  <FileUp className="size-5 text-[oklch(38%_0.09_155)]" />
                </div>
                <span className="text-[12.5px] font-semibold">
                  {file?.name ?? "Choisir un fichier"}
                </span>
              </label>
              <input
                id="residence-doc-file"
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
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
