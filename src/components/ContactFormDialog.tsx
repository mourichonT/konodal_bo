import { useEffect, useState, type FormEvent } from "react"
import { Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AddressAutocompleteInput } from "@/components/AddressAutocompleteInput"
import { toast } from "sonner"
import type { ContactInput } from "@/lib/contacts"
import { CONTACT_SERVICES } from "@/types/contact"
import { emptyAddress } from "@/types/residence"

type ResidenceOption = { id: string; name: string }

export function ContactFormDialog({
  open,
  onOpenChange,
  title,
  residences,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  residences: ResidenceOption[]
  onSubmit: (input: ContactInput) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [service, setService] = useState<string>(CONTACT_SERVICES[0])
  const [phone, setPhone] = useState("")
  const [mail, setMail] = useState("")
  const [street, setStreet] = useState(emptyAddress.street)
  const [zipCode, setZipCode] = useState(emptyAddress.zipCode)
  const [city, setCity] = useState(emptyAddress.city)
  const [web, setWeb] = useState("")
  const [residencesIds, setResidencesIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Ce formulaire ne sert qu'à la création (l'édition vit sur
  // ContactDetailPage) - réinitialise à vide à chaque ouverture.
  useEffect(() => {
    if (open) {
      setName("")
      setService(CONTACT_SERVICES[0])
      setPhone("")
      setMail("")
      setStreet(emptyAddress.street)
      setZipCode(emptyAddress.zipCode)
      setCity(emptyAddress.city)
      setWeb("")
      setResidencesIds([])
    }
  }, [open])

  function toggleResidence(id: string, checked: boolean) {
    setResidencesIds((prev) => (checked ? [...prev, id] : prev.filter((r) => r !== id)))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit({
        name,
        service,
        phone,
        mail,
        address: { ...emptyAddress, street, zipCode, city },
        web,
        residencesIds,
      })
    } catch (err) {
      toast.error("Échec de l'enregistrement : " + (err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4">
          <DialogHeader className="pb-4">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-name">Nom</Label>
              <Input id="contact-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-service">Service</Label>
              <select
                id="contact-service"
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {CONTACT_SERVICES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact-phone">Téléphone</Label>
                <Input id="contact-phone" required value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact-mail">Email</Label>
                <Input
                  id="contact-mail"
                  type="email"
                  value={mail}
                  onChange={(e) => setMail(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-street">Adresse</Label>
              <AddressAutocompleteInput
                id="contact-street"
                value={street}
                onChange={setStreet}
                onSelect={(a) => {
                  setStreet(a.street)
                  setZipCode(a.zipCode)
                  setCity(a.city)
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact-zip">Code postal</Label>
                <Input id="contact-zip" value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact-city">Ville</Label>
                <Input id="contact-city" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-web">Site web</Label>
              <Input id="contact-web" type="url" value={web} onChange={(e) => setWeb(e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Résidences</Label>
              <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-input p-2">
                {residences.length === 0 && (
                  <p className="px-1 py-1 text-sm text-muted-foreground">Aucune résidence.</p>
                )}
                {residences.map((residence) => (
                  <label
                    key={residence.id}
                    className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={residencesIds.includes(residence.id)}
                      onChange={(e) => toggleResidence(residence.id, e.target.checked)}
                      className="size-4 rounded border-input accent-primary"
                    />
                    {residence.name}
                  </label>
                ))}
              </div>
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
