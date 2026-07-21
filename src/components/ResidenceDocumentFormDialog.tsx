import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { ChevronDown, FileUp, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
          <DialogHeader className="pb-4">
            <DialogTitle>Ajouter un document de résidence</DialogTitle>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-4">
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
                className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-input p-4 text-sm text-muted-foreground hover:bg-muted/50"
              >
                <FileUp className="size-6" />
                {file?.name ?? "Choisir un fichier"}
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
