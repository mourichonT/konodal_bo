import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  createResidence,
  subscribeToResidences,
  updateResidence,
  type ResidenceInput,
} from "@/lib/residences"
import { emptyAddress, type Residence } from "@/types/residence"

function residenceToInput(residence: Residence): ResidenceInput {
  return {
    name: residence.name,
    address: residence.address,
    mail_contact: residence.mail_contact ?? "",
  }
}

export default function ResidencesPage() {
  const [residences, setResidences] = useState<Residence[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Residence | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    setLoading(true)
    return subscribeToResidences(
      (data) => {
        setResidences(data)
        setLoading(false)
      },
      (error) => {
        toast.error("Impossible de charger les résidences : " + error.message)
        setLoading(false)
      }
    )
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Résidences</h1>
        <Button onClick={() => setCreating(true)}>
          <Plus />
          Ajouter une résidence
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Résidence</TableHead>
              <TableHead>Adresse</TableHead>
              <TableHead>Code postal</TableHead>
              <TableHead>Ville</TableHead>
              <TableHead>Lots</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {residences.map((residence) => (
              <TableRow key={residence.id}>
                <TableCell className="font-medium">{residence.name}</TableCell>
                <TableCell>{residence.address.street}</TableCell>
                <TableCell>{residence.address.zipCode}</TableCell>
                <TableCell>{residence.address.city}</TableCell>
                <TableCell>{residence.totalLot}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => setEditing(residence)}>
                    Modifier
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && residences.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Aucune résidence pour l'instant.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ResidenceFormDialog
        open={creating}
        onOpenChange={setCreating}
        title="Ajouter une résidence"
        onSubmit={async (input) => {
          await createResidence(input)
          toast.success("Résidence créée")
          setCreating(false)
        }}
      />

      <ResidenceFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="Modifier la résidence"
        initial={editing ? residenceToInput(editing) : undefined}
        onSubmit={async (input) => {
          if (!editing) return
          await updateResidence(editing.id, input)
          toast.success("Résidence mise à jour")
          setEditing(null)
        }}
      />
    </div>
  )
}

function ResidenceFormDialog({
  open,
  onOpenChange,
  title,
  initial,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  initial?: ResidenceInput
  onSubmit: (input: ResidenceInput) => Promise<void>
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [street, setStreet] = useState(initial?.address.street ?? emptyAddress.street)
  const [zipCode, setZipCode] = useState(initial?.address.zipCode ?? emptyAddress.zipCode)
  const [city, setCity] = useState(initial?.address.city ?? emptyAddress.city)
  const [mailContact, setMailContact] = useState(initial?.mail_contact ?? "")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "")
      setStreet(initial?.address.street ?? emptyAddress.street)
      setZipCode(initial?.address.zipCode ?? emptyAddress.zipCode)
      setCity(initial?.address.city ?? emptyAddress.city)
      setMailContact(initial?.mail_contact ?? "")
    }
  }, [open, initial])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit({
        name,
        address: { ...emptyAddress, street, zipCode, city },
        mail_contact: mailContact,
      })
    } catch (err) {
      toast.error("Échec de l'enregistrement : " + (err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="res-name">Nom de la résidence</Label>
            <Input id="res-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="res-street">Adresse</Label>
            <Input id="res-street" required value={street} onChange={(e) => setStreet(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="res-zip">Code postal</Label>
              <Input id="res-zip" required value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="res-city">Ville</Label>
              <Input id="res-city" required value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="res-mail">Email de contact</Label>
            <Input
              id="res-mail"
              type="email"
              value={mailContact}
              onChange={(e) => setMailContact(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
