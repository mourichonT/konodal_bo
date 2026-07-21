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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { resolveUserLabels } from "@/lib/users"
import {
  LOT_DOCUMENT_CATEGORIES,
  defaultRecipientRolesForCategory,
  type LotDocumentInput,
} from "@/types/document"
import type { LotWithResidence } from "@/hooks/useAllLots"

const ACCEPTED_FILE_TYPES = ".pdf,.jpg,.jpeg,.png"

type Recipient = { uid: string; label: string }

async function resolveRecipients(uids: string[]): Promise<Recipient[]> {
  const labels = await resolveUserLabels(uids)
  return [...new Set(uids)].map((uid) => ({ uid, label: labels.get(uid) ?? uid }))
}

export function LotDocumentFormDialog({
  open,
  onOpenChange,
  lot,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  lot: LotWithResidence | null
  onSubmit: (input: LotDocumentInput) => Promise<void>
}) {
  const [category, setCategory] = useState<string>(LOT_DOCUMENT_CATEGORIES[0])
  const [name, setName] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [owners, setOwners] = useState<Recipient[]>([])
  const [tenants, setTenants] = useState<Recipient[]>([])
  const [selectedOwnerUids, setSelectedOwnerUids] = useState<string[]>([])
  const [selectedTenantUids, setSelectedTenantUids] = useState<string[]>([])
  const [loadingRecipients, setLoadingRecipients] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !lot) return
    setCategory(LOT_DOCUMENT_CATEGORIES[0])
    setName("")
    setFile(null)
    setLoadingRecipients(true)
    Promise.all([resolveRecipients(lot.idProprietaire), resolveRecipients(lot.idLocataire)])
      .then(([ownerRecipients, tenantRecipients]) => {
        setOwners(ownerRecipients)
        setTenants(tenantRecipients)
        const defaults = defaultRecipientRolesForCategory(LOT_DOCUMENT_CATEGORIES[0])
        setSelectedOwnerUids(defaults.includes("proprietaire") ? ownerRecipients.map((r) => r.uid) : [])
        setSelectedTenantUids(defaults.includes("locataire") ? tenantRecipients.map((r) => r.uid) : [])
      })
      .catch(() => toast.error("Impossible de charger les propriétaires/locataires de ce lot"))
      .finally(() => setLoadingRecipients(false))
  }, [open, lot])

  function handleCategoryChange(next: string) {
    setCategory(next)
    const defaults = defaultRecipientRolesForCategory(next)
    setSelectedOwnerUids(defaults.includes("proprietaire") ? owners.map((r) => r.uid) : [])
    setSelectedTenantUids(defaults.includes("locataire") ? tenants.map((r) => r.uid) : [])
  }

  const noRecipientsAtAll = !loadingRecipients && owners.length === 0 && tenants.length === 0

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      toast.error("Le nom du document est requis")
      return
    }
    if (!file) {
      toast.error("Un fichier est requis")
      return
    }
    const recipientUids = [...new Set([...selectedOwnerUids, ...selectedTenantUids])]
    if (recipientUids.length === 0) {
      toast.error("Sélectionnez au moins un destinataire")
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({ name: name.trim(), category, file, recipientUids })
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
            <DialogTitle>Ajouter un document de lot {lot ? `— ${lot.refLot || lot.lot}` : ""}</DialogTitle>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-4">
            {noRecipientsAtAll ? (
              <p className="rounded-lg border border-dashed border-input p-4 text-sm text-muted-foreground">
                Aucun propriétaire ni locataire rattaché à ce lot pour l'instant. Attribuez d'abord un
                propriétaire ou un locataire à ce lot avant d'y ajouter un document.
              </p>
            ) : (
              <div className={loadingRecipients ? "pointer-events-none opacity-50" : undefined}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label>Catégorie</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
                        {category}
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-72">
                        <DropdownMenuRadioGroup value={category} onValueChange={handleCategoryChange}>
                          {LOT_DOCUMENT_CATEGORIES.map((c) => (
                            <DropdownMenuRadioItem key={c} value={c}>
                              {c}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="lot-doc-name">Nom du document</Label>
                    <Input
                      id="lot-doc-name"
                      required
                      placeholder="Ex : Quittance mars 2026"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="lot-doc-file">Fichier (PDF, JPG ou PNG)</Label>
                    <label
                      htmlFor="lot-doc-file"
                      className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-input p-4 text-sm text-muted-foreground hover:bg-muted/50"
                    >
                      <FileUp className="size-6" />
                      {file?.name ?? "Choisir un fichier"}
                    </label>
                    <input
                      id="lot-doc-file"
                      type="file"
                      accept={ACCEPTED_FILE_TYPES}
                      className="hidden"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label>Destinataires</Label>
                    {owners.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Propriétaire(s)</span>
                        {owners.map((r) => (
                          <label key={r.uid} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted/50">
                            <input
                              type="checkbox"
                              checked={selectedOwnerUids.includes(r.uid)}
                              onChange={(e) =>
                                setSelectedOwnerUids((prev) =>
                                  e.target.checked ? [...prev, r.uid] : prev.filter((uid) => uid !== r.uid)
                                )
                              }
                              className="size-4 rounded border-input accent-primary"
                            />
                            {r.label}
                          </label>
                        ))}
                      </div>
                    )}
                    {tenants.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Locataire(s)</span>
                        {tenants.map((r) => (
                          <label key={r.uid} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted/50">
                            <input
                              type="checkbox"
                              checked={selectedTenantUids.includes(r.uid)}
                              onChange={(e) =>
                                setSelectedTenantUids((prev) =>
                                  e.target.checked ? [...prev, r.uid] : prev.filter((uid) => uid !== r.uid)
                                )
                              }
                              className="size-4 rounded border-input accent-primary"
                            />
                            {r.label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting || noRecipientsAtAll || loadingRecipients}>
              <Save />
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
