import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PRIMARY_CTA_CLASS } from "@/lib/utils"
import { findProEntreprise, linkProContact, type ProFindResult } from "@/lib/proAccounts"
import { PRO_CONFORMITE_LABELS } from "@/types/contact"
import type { Residence } from "@/types/residence"

// Ajoute un prestataire inscrit sur Konodal Pro au carnet du syndic, à
// partir de sa référence, de son SIRET ou du lien de sa fiche (QR code
// scanné avec un téléphone, ou lien reçu par mail, qui ouvre
// /contacts/ajouter-pro?ref=...). Une fiche contact est créée à partir de
// l'entreprise et rattachée aux résidences cochées.
export function ProProviderAddDialog({
  open,
  onOpenChange,
  residences,
  initialQuery = "",
  onAdded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  residences: Residence[]
  initialQuery?: string
  onAdded?: (contactId: string) => void
}) {
  const [query, setQuery] = useState(initialQuery)
  const [result, setResult] = useState<ProFindResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [residenceIds, setResidenceIds] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    setQuery(initialQuery)
    setResult(null)
    setResidenceIds([])
    if (initialQuery) void search(initialQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialQuery])

  async function search(value: string) {
    if (!value.trim()) return
    setSearching(true)
    try {
      setResult(await findProEntreprise(value.trim()))
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSearching(false)
    }
  }

  async function handleAdd() {
    if (!result?.found) return
    setSaving(true)
    try {
      // Fiche contact déjà reliée (annuaire partagé) : réutilisée plutôt que
      // dupliquée ; sinon créée à partir de l'entreprise.
      const { contactId } = await linkProContact(result.entrepriseId, {
        contactId: result.contactIds[0],
        residenceIds,
      })
      toast.success(`${result.raisonSociale} ajouté à votre carnet`)
      onAdded?.(contactId)
      onOpenChange(false)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="pb-2">
          <DialogTitle>Ajouter un prestataire Konodal Pro</DialogTitle>
        </DialogHeader>
        <form
          className="flex gap-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            void search(query)
          }}
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Référence (P…), SIRET ou lien de la fiche"
            autoFocus
          />
          <Button type="submit" variant="outline" disabled={searching}>
            <Search />
            Rechercher
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          Le prestataire trouve sa référence et son QR code dans Konodal Pro (onglet Entreprise).
        </p>

        {result && !result.found && (
          <p className="text-sm text-muted-foreground">Aucun prestataire Konodal Pro ne correspond.</p>
        )}
        {result?.found && (
          <div className="flex flex-col gap-3 rounded-lg border p-3">
            <div>
              <p className="font-semibold">{result.raisonSociale}</p>
              <p className="text-sm text-muted-foreground">
                {[result.city, `SIRET ${result.siret}`, result.ref].filter(Boolean).join(" · ")}
              </p>
              <p className="text-sm">{result.metiers.join(", ")}</p>
              <p className="text-xs text-muted-foreground">
                Départements : {result.departements.join(", ")} · {PRO_CONFORMITE_LABELS[result.conformite]}
              </p>
            </div>
            {result.inCarnet && (
              <p className="text-sm text-emerald-700">Déjà dans le carnet de votre agence.</p>
            )}
            {residences.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label>Rattacher aux résidences</Label>
                <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                  {residences.map((r) => (
                    <label key={r.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={residenceIds.includes(r.id)}
                        onChange={(e) =>
                          setResidenceIds((ids) => (e.target.checked ? [...ids, r.id] : ids.filter((id) => id !== r.id)))
                        }
                      />
                      {r.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button className={PRIMARY_CTA_CLASS} disabled={!result?.found || saving} onClick={handleAdd}>
            Ajouter à mon carnet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
