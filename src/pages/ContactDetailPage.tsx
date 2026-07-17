import { useEffect, useState, type FormEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft, CheckCircle2, Save, Trash2, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { subscribeToResidences } from "@/lib/residences"
import {
  deleteContact,
  setContactResidenceLink,
  subscribeToContact,
  updateContact,
  updateContactApproval,
} from "@/lib/contacts"
import { CONTACT_SERVICES } from "@/types/contact"
import { emptyAddress } from "@/types/residence"
import type { Contact } from "@/types/contact"
import type { Residence } from "@/types/residence"

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  const [residences, setResidences] = useState<Residence[]>([])
  const [initialized, setInitialized] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [name, setName] = useState("")
  const [service, setService] = useState<string>(CONTACT_SERVICES[0])
  const [phone, setPhone] = useState("")
  const [mail, setMail] = useState("")
  const [street, setStreet] = useState(emptyAddress.street)
  const [zipCode, setZipCode] = useState(emptyAddress.zipCode)
  const [city, setCity] = useState(emptyAddress.city)
  const [web, setWeb] = useState("")

  useEffect(() => {
    if (!id) return
    setLoading(true)
    return subscribeToContact(
      id,
      (data) => {
        setContact(data)
        setLoading(false)
      },
      (error) => {
        toast.error("Impossible de charger le contact : " + error.message)
        setLoading(false)
      }
    )
  }, [id])

  useEffect(() => {
    return subscribeToResidences(
      setResidences,
      (error) => toast.error("Impossible de charger les résidences : " + error.message)
    )
  }, [])

  // Ne préremplit le formulaire qu'une fois, au premier chargement - les
  // mises à jour temps réel suivantes de `contact` (ex: après un toggle de
  // résidence) ne doivent pas écraser une saisie en cours dans la colonne
  // "fiche".
  useEffect(() => {
    if (contact && !initialized) {
      setName(contact.name)
      setService(contact.service || CONTACT_SERVICES[0])
      setPhone(contact.phone)
      setMail(contact.mail)
      setStreet(contact.address.street || emptyAddress.street)
      setZipCode(contact.address.zipCode || emptyAddress.zipCode)
      setCity(contact.address.city || emptyAddress.city)
      setWeb(contact.web)
      setInitialized(true)
    }
  }, [contact, initialized])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!id) return
    setSubmitting(true)
    try {
      await updateContact(id, {
        name,
        service,
        phone,
        mail,
        address: { ...emptyAddress, street, zipCode, city },
        web,
      })
      toast.success("Contact mis à jour")
    } catch (err) {
      toast.error("Échec de l'enregistrement : " + (err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleApproval() {
    if (!id || !contact) return
    try {
      await updateContactApproval(id, !contact.isApproved)
      toast.success(contact.isApproved ? "Contact repassé en attente" : "Contact approuvé")
    } catch (err) {
      toast.error("Échec de la mise à jour : " + (err as Error).message)
    }
  }

  async function handleToggleResidence(residenceId: string, checked: boolean) {
    if (!id) return
    try {
      await setContactResidenceLink(residenceId, id, checked)
    } catch (err) {
      toast.error("Échec de la mise à jour : " + (err as Error).message)
    }
  }

  async function handleDelete() {
    if (!id) return
    try {
      await deleteContact(id)
      toast.success("Contact supprimé")
      navigate("/contacts")
    } catch (err) {
      toast.error("Échec de la suppression : " + (err as Error).message)
    }
  }

  if (!id) return null

  return (
    <div className="-mt-[20px] flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link
          to="/contacts"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Contacts
        </Link>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">
            {contact ? contact.name || "Sans nom" : loading ? "…" : "Contact introuvable"}
          </h1>
          {contact && (
            <div className="flex items-center gap-2">
              <Badge
                variant={contact.isApproved ? "default" : "outline"}
                className={!contact.isApproved ? "border-transparent bg-amber-100 text-amber-800" : undefined}
              >
                {contact.isApproved ? "Approuvé" : "En attente"}
              </Badge>
              <Button variant="outline" size="sm" onClick={handleToggleApproval}>
                {contact.isApproved ? <XCircle /> : <CheckCircle2 />}
                {contact.isApproved ? "Désapprouver" : "Approuver"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDeleting(true)}>
                <Trash2 />
                Supprimer
              </Button>
            </div>
          )}
        </div>
      </div>

      {!loading && !contact && (
        <p className="text-muted-foreground">Ce contact n'existe pas ou a été supprimé.</p>
      )}

      {contact && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
            <CardHeader>
              <CardTitle className="text-base">Fiche contact</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                    <Input
                      id="contact-phone"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
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
                  <Input id="contact-street" value={street} onChange={(e) => setStreet(e.target.value)} />
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
                <div className="flex justify-end">
                  <Button type="submit" disabled={submitting}>
                    <Save />
                    Enregistrer
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
            <CardHeader>
              <CardTitle className="text-base">Résidences</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1">
                {residences.length === 0 && (
                  <p className="px-1 py-1 text-sm text-muted-foreground">Aucune résidence.</p>
                )}
                {residences.map((residence) => (
                  <label
                    key={residence.id}
                    className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={!!residence.contactRefs?.[contact.id]}
                      onChange={(e) => handleToggleResidence(residence.id, e.target.checked)}
                      className="size-4 rounded border-input accent-primary"
                    />
                    {residence.name}
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-4">
            <DialogTitle>Supprimer ce contact ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            "{contact?.name}" sera définitivement supprimé de l'annuaire partagé, pour toutes les
            résidences qui le référencent.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(false)}>
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
