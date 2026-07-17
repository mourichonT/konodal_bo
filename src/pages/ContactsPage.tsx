import { useMemo, useState } from "react"
import { toast } from "sonner"
import { CheckCircle2, Clock3, Merge, Pencil, Plus, Search, Trash2, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ContactFormDialog } from "@/components/ContactFormDialog"
import { useAllContacts } from "@/hooks/useAllContacts"
import {
  createContact,
  deleteContact,
  dismissDuplicate,
  mergeContacts,
  updateContact,
  updateContactApproval,
  type ContactInput,
} from "@/lib/contacts"
import type { Contact } from "@/types/contact"
import { cn } from "@/lib/utils"

function matchesSearch(contact: Contact, search: string): boolean {
  const haystack = [contact.name, contact.service, contact.phone, contact.mail].join(" ").toLowerCase()
  return haystack.includes(search.toLowerCase())
}

export default function ContactsPage() {
  const { contacts, residences, loading } = useAllContacts((message) => toast.error(message))
  const [search, setSearch] = useState("")
  const [pendingOnly, setPendingOnly] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [deleting, setDeleting] = useState<Contact | null>(null)
  const [merging, setMerging] = useState<{ keep: Contact; other: Contact } | null>(null)

  const residenceNameById = useMemo(
    () => new Map(residences.map((r) => [r.id, r.name])),
    [residences]
  )
  const contactById = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts])

  const pendingCount = contacts.filter((c) => !c.isApproved).length

  const filteredContacts = contacts.filter((c) => {
    if (pendingOnly && c.isApproved) return false
    if (!search.trim()) return true
    return matchesSearch(c, search)
  })

  // Chaque paire n'est affichée qu'une fois (id < autreId) - les groupes de
  // 3+ (même nom normalisé sur 3 résidences) se résolvent par fusions
  // successives, mergeContacts() reporte déjà la fusion sur les tiers.
  const duplicatePairs = contacts.flatMap((c) =>
    c.likelyDuplicateIds
      .filter((otherId) => c.id < otherId && contactById.has(otherId))
      .map((otherId) => ({ a: c, b: contactById.get(otherId)! }))
  )

  async function handleToggleApproval(contact: Contact) {
    try {
      await updateContactApproval(contact.id, !contact.isApproved)
      toast.success(contact.isApproved ? "Contact repassé en attente" : "Contact approuvé")
    } catch (err) {
      toast.error("Échec de la mise à jour : " + (err as Error).message)
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await deleteContact(deleting.id)
      toast.success("Contact supprimé")
      setDeleting(null)
    } catch (err) {
      toast.error("Échec de la suppression : " + (err as Error).message)
    }
  }

  async function handleDismiss(a: Contact, b: Contact) {
    try {
      await dismissDuplicate(a.id, b.id)
      toast.success("Doublon ignoré")
    } catch (err) {
      toast.error("Échec : " + (err as Error).message)
    }
  }

  async function handleMerge() {
    if (!merging) return
    try {
      await mergeContacts(merging.keep.id, merging.other.id)
      toast.success("Contacts fusionnés")
      setMerging(null)
    } catch (err) {
      toast.error("Échec de la fusion : " + (err as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <Button onClick={() => setCreating(true)}>
          <Plus />
          Ajouter un contact
        </Button>
      </div>

      {duplicatePairs.length > 0 && (
        <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
          <CardHeader>
            <CardTitle className="text-base">Doublons potentiels ({duplicatePairs.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {duplicatePairs.map(({ a, b }) => (
              <div
                key={`${a.id}-${b.id}`}
                className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-1 text-sm sm:flex-row sm:gap-6">
                  <div>
                    <span className="font-medium">{a.name}</span>{" "}
                    <span className="text-muted-foreground">
                      ({a.residencesIds.map((id) => residenceNameById.get(id) ?? id).join(", ") || "—"})
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">{b.name}</span>{" "}
                    <span className="text-muted-foreground">
                      ({b.residencesIds.map((id) => residenceNameById.get(id) ?? id).join(", ") || "—"})
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleDismiss(a, b)}>
                    <X />
                    Pas un doublon
                  </Button>
                  <Button size="sm" onClick={() => setMerging({ keep: a, other: b })}>
                    <Merge />
                    Fusionner
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
        <CardContent className="flex flex-col">
          <div className="mt-[10px] mb-[30px] flex items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher un contact…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-full pl-9"
              />
            </div>
            <button
              type="button"
              onClick={() => setPendingOnly((prev) => !prev)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                pendingOnly ? "border-amber-300 bg-amber-50 text-amber-800" : "border-input text-muted-foreground"
              )}
            >
              <Clock3 className="size-4" />
              {pendingCount} en attente d'approbation
            </button>
          </div>

          <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Résidences</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.name || "Sans nom"}</TableCell>
                    <TableCell>{contact.service}</TableCell>
                    <TableCell>{contact.phone}</TableCell>
                    <TableCell>{contact.mail}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {contact.residencesIds.length === 0 && (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                        {contact.residencesIds.map((id) => (
                          <Badge key={id} variant="secondary">
                            {residenceNameById.get(id) ?? id}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "border-transparent",
                          contact.isApproved ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        )}
                      >
                        {contact.isApproved ? "Approuvé" : "En attente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {!contact.isApproved && (
                          <Button variant="outline" size="sm" onClick={() => handleToggleApproval(contact)}>
                            <CheckCircle2 />
                            Approuver
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => setEditing(contact)}>
                          <Pencil />
                          Modifier
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setDeleting(contact)}>
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filteredContacts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      {contacts.length === 0
                        ? "Aucun contact pour l'instant."
                        : "Aucun résultat pour cette recherche."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            {filteredContacts.length} contact{filteredContacts.length > 1 ? "s" : ""} affiché
            {filteredContacts.length > 1 ? "s" : ""} sur {contacts.length}
          </p>
        </CardContent>
      </Card>

      <ContactFormDialog
        open={creating}
        onOpenChange={setCreating}
        title="Ajouter un contact"
        residences={residences}
        onSubmit={async (input: ContactInput) => {
          await createContact(input)
          toast.success("Contact créé")
          setCreating(false)
        }}
      />

      <ContactFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="Modifier le contact"
        residences={residences}
        initial={editing ?? undefined}
        onSubmit={async (input: ContactInput) => {
          if (!editing) return
          await updateContact(editing.id, input)
          toast.success("Contact mis à jour")
          setEditing(null)
        }}
      />

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-4">
            <DialogTitle>Supprimer ce contact ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            "{deleting?.name}" sera définitivement supprimé de l'annuaire partagé, pour toutes les
            résidences qui le référencent.
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

      <Dialog open={!!merging} onOpenChange={(open) => !open && setMerging(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-4">
            <DialogTitle>Fusionner ces contacts ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            "{merging?.other.name}" sera supprimé et ses résidences ajoutées à "{merging?.keep.name}".
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMerging(null)}>
              Annuler
            </Button>
            <Button onClick={handleMerge}>Confirmer la fusion</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
