import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { FileText, Plus, Search, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { PRIMARY_CTA_CLASS } from "@/lib/utils"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SearchableSelect } from "@/components/SearchableSelect"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ResidenceDocumentFormDialog } from "@/components/ResidenceDocumentFormDialog"
import { LotDocumentFormDialog } from "@/components/LotDocumentFormDialog"
import {
  useAllResidenceDocuments,
  type ResidenceDocumentWithResidence,
} from "@/hooks/useAllResidenceDocuments"
import { useAllLots, type LotWithResidence } from "@/hooks/useAllLots"
import { useScopedResidenceIds } from "@/hooks/useScopedResidenceIds"
import { createResidenceDocument, deleteResidenceDocument } from "@/lib/residenceDocuments"
import { createLotDocument, deleteLotDocument, subscribeToLotDocuments } from "@/lib/lotDocuments"
import { resolveUserLabels } from "@/lib/users"
import { RESIDENCE_DOCUMENT_CATEGORIES } from "@/types/document"
import type { LotDocument } from "@/types/document"

function formatDate(date: Date | null): string {
  return date ? date.toLocaleDateString("fr-FR") : "—"
}

export default function DocumentsPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-[26px] font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">Documents</h1>
      <ResidenceDocumentsSection />
      <LotDocumentsSection />
    </div>
  )
}

function ResidenceDocumentsSection() {
  const { scopedResidenceIds } = useScopedResidenceIds()
  const { documents, residences, loading } = useAllResidenceDocuments(
    (message) => toast.error(message),
    scopedResidenceIds
  )
  const [search, setSearch] = useState("")
  const [residenceFilter, setResidenceFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<ResidenceDocumentWithResidence | null>(null)

  const filteredDocuments = documents.filter((d) => {
    if (residenceFilter !== "all" && d.residenceId !== residenceFilter) return false
    if (categoryFilter !== "all" && d.category !== categoryFilter) return false
    if (!search.trim()) return true
    return [d.name, d.category, d.residenceName].join(" ").toLowerCase().includes(search.toLowerCase())
  })

  async function handleDelete() {
    if (!deleting) return
    try {
      await deleteResidenceDocument(deleting.residenceId, deleting.id)
      toast.success("Document supprimé")
      setDeleting(null)
    } catch (err) {
      toast.error("Échec de la suppression : " + (err as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg">Documents de résidence</h2>
        <Button onClick={() => setCreating(true)} className={PRIMARY_CTA_CLASS}>
          <Plus />
          Ajouter un document
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un document…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <SearchableSelect
            className="w-56"
            value={residenceFilter}
            onChange={setResidenceFilter}
            groups={[
              {
                options: [
                  { value: "all", label: "Toutes les résidences" },
                  ...[...residences]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((r) => ({ value: r.id, label: r.name })),
                ],
              },
            ]}
          />
          <SearchableSelect
            className="w-64"
            value={categoryFilter}
            onChange={setCategoryFilter}
            groups={[
              {
                options: [
                  { value: "all", label: "Toutes les catégories" },
                  ...RESIDENCE_DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: c })),
                ],
              },
            ]}
          />
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-[24px] border border-[oklch(93%_0.005_100)] bg-white shadow-[0_1px_2px_oklch(20%_0_0/0.03),0_14px_34px_-22px_oklch(20%_0_0/0.12)]">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Résidence</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white">
            {filteredDocuments.map((d) => (
              <TableRow key={`${d.residenceId}-${d.id}`}>
                <TableCell>{d.residenceName}</TableCell>
                <TableCell className="font-medium">{d.name || "Sans nom"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{d.category || "—"}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(d.timeStamp)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      render={<a href={d.documentPathRecto} target="_blank" rel="noreferrer" />}
                    >
                      <FileText />
                      Voir
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDeleting(d)}>
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!loading && filteredDocuments.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  {documents.length === 0
                    ? "Aucun document de résidence pour l'instant."
                    : "Aucun résultat pour ces filtres."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ResidenceDocumentFormDialog
        open={creating}
        onOpenChange={setCreating}
        residences={residences}
        initialResidenceId={residenceFilter}
        onSubmit={async (residenceId, input) => {
          await createResidenceDocument(residenceId, input)
          toast.success("Document ajouté")
          setCreating(false)
        }}
      />

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-4">
            <DialogTitle>Supprimer ce document ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            "{deleting?.name}" sera définitivement supprimé de la résidence {deleting?.residenceName}.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LotDocumentsSection() {
  const { scopedResidenceIds } = useScopedResidenceIds()
  const { lots, loading: lotsLoading } = useAllLots((message) => toast.error(message), scopedResidenceIds)
  const [residenceFilter, setResidenceFilter] = useState("")
  const [lotId, setLotId] = useState("")
  const [lotDocuments, setLotDocuments] = useState<LotDocument[]>([])
  const [recipientLabels, setRecipientLabels] = useState<Map<string, string>>(new Map())
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<LotDocument | null>(null)

  const residenceOptions = useMemo(() => {
    const byId = new Map<string, string>()
    for (const l of lots) byId.set(l.residenceId, l.residenceName)
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [lots])

  const lotsForResidence = useMemo(
    () => lots.filter((l) => l.residenceId === residenceFilter).sort((a, b) => a.lot.localeCompare(b.lot)),
    [lots, residenceFilter]
  )

  const selectedLot: LotWithResidence | null = lots.find((l) => l.id === lotId) ?? null
  const recipientUids = useMemo(
    () => (selectedLot ? [...new Set([...selectedLot.idProprietaire, ...selectedLot.idLocataire])] : []),
    [selectedLot]
  )
  const recipientUidsKey = recipientUids.slice().sort().join(",")

  useEffect(() => {
    setLotId("")
  }, [residenceFilter])

  useEffect(() => {
    if (!selectedLot) {
      setLotDocuments([])
      return
    }
    return subscribeToLotDocuments(
      selectedLot.residenceId,
      selectedLot.id,
      recipientUids,
      setLotDocuments,
      (error) => toast.error("Impossible de charger les documents de ce lot : " + error.message)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLot?.residenceId, selectedLot?.id, recipientUidsKey])

  useEffect(() => {
    if (recipientUids.length === 0) {
      setRecipientLabels(new Map())
      return
    }
    resolveUserLabels(recipientUids).then(setRecipientLabels)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientUidsKey])

  async function handleDelete() {
    if (!deleting || !selectedLot) return
    try {
      await deleteLotDocument(selectedLot.id, deleting.id, deleting.recipientUids)
      toast.success("Document supprimé")
      setDeleting(null)
    } catch (err) {
      toast.error("Échec de la suppression : " + (err as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg">Documents de lot</h2>
        <Button onClick={() => setCreating(true)} disabled={!selectedLot} className={PRIMARY_CTA_CLASS}>
          <Plus />
          Ajouter un document
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchableSelect
          className="w-56"
          value={residenceFilter}
          onChange={setResidenceFilter}
          emptyLabel="Résidence : Choisir…"
          groups={[{ options: residenceOptions.map(([id, name]) => ({ value: id, label: name })) }]}
        />
        <SearchableSelect
          className="w-56"
          value={lotId}
          onChange={setLotId}
          disabled={!residenceFilter}
          emptyLabel="Lot : Choisir…"
          noResultsLabel="Aucun lot."
          groups={[
            {
              options: lotsForResidence.map((l) => ({
                value: l.id,
                label: `${l.refLot || l.lot}${l.batiment ? ` — ${l.batiment}` : ""}`,
              })),
            },
          ]}
        />
      </div>

      {!selectedLot ? (
        <p className="rounded-xl border border-dashed border-input p-8 text-center text-sm text-muted-foreground">
          Choisissez une résidence puis un lot pour voir ses documents.
        </p>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-[oklch(93%_0.005_100)] bg-white shadow-[0_1px_2px_oklch(20%_0_0/0.03),0_14px_34px_-22px_oklch(20%_0_0/0.12)]">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Destinataires</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white">
              {lotDocuments.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name || "Sans nom"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{d.category || "—"}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {d.recipientUids.map((uid) => (
                        <Badge key={uid} variant="secondary">
                          {recipientLabels.get(uid) ?? uid}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(d.timeStamp)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        render={<a href={d.documentPathRecto} target="_blank" rel="noreferrer" />}
                      >
                        <FileText />
                        Voir
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setDeleting(d)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!lotsLoading && lotDocuments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Aucun document pour ce lot.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <LotDocumentFormDialog
        open={creating}
        onOpenChange={setCreating}
        lot={selectedLot}
        onSubmit={async (input) => {
          if (!selectedLot) return
          await createLotDocument(selectedLot.residenceId, selectedLot.id, input)
          toast.success("Document ajouté")
          setCreating(false)
        }}
      />

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-4">
            <DialogTitle>Supprimer ce document ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            "{deleting?.name}" sera définitivement supprimé pour tous ses destinataires.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
