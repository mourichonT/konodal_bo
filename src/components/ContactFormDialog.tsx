import { useEffect, useState, type FormEvent } from "react"
import { Save, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PRIMARY_CTA_CLASS } from "@/lib/utils"
import { AddressAutocompleteInput } from "@/components/AddressAutocompleteInput"
import { ZipCodeCityInput } from "@/components/ZipCodeCityInput"
import { toast } from "sonner"
import type { ContactInput } from "@/lib/contacts"
import { CONTACT_SERVICES } from "@/types/contact"
import { emptyAddress } from "@/types/residence"
import { searchCompanies, type CompanySearchResult } from "@/lib/companySearch"
import { subscribeToGerances } from "@/lib/gerances"
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin"

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
  const { isSuperAdmin } = useIsSuperAdmin()
  const [name, setName] = useState("")
  const [service, setService] = useState<string>(CONTACT_SERVICES[0])
  const [siret, setSiret] = useState("")
  const [phone, setPhone] = useState("")
  const [mail, setMail] = useState("")
  const [street, setStreet] = useState(emptyAddress.street)
  const [zipCode, setZipCode] = useState(emptyAddress.zipCode)
  const [city, setCity] = useState(emptyAddress.city)
  const [web, setWeb] = useState("")
  const [residencesIds, setResidencesIds] = useState<string[]>([])
  const [geranceIds, setGeranceIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Rattachement gérance entière (annuaire Superadmin uniquement, cf.
  // Gerance.contactRefs) - une agence/agent ne voit que la sélection par
  // résidence ci-dessus.
  const [gerances, setGerances] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    if (!isSuperAdmin) return
    return subscribeToGerances(setGerances, () => {
      toast.error("Impossible de charger les agences")
    })
  }, [isSuperAdmin])

  // Recherche recherche-entreprises.api.gouv.fr (cf. companySearch.ts) - même
  // usage que GeranceFormDialog (AgencesPage) : un résultat choisi ne fait
  // que préremplir les champs ci-dessous, revus/corrigibles avant
  // "Enregistrer".
  const [companyQuery, setCompanyQuery] = useState("")
  const [companyResults, setCompanyResults] = useState<CompanySearchResult[]>([])
  const [searching, setSearching] = useState(false)

  // Ce formulaire ne sert qu'à la création (l'édition vit sur
  // ContactDetailPage) - réinitialise à vide à chaque ouverture.
  useEffect(() => {
    if (open) {
      setName("")
      setService(CONTACT_SERVICES[0])
      setSiret("")
      setPhone("")
      setMail("")
      setStreet(emptyAddress.street)
      setZipCode(emptyAddress.zipCode)
      setCity(emptyAddress.city)
      setWeb("")
      setResidencesIds([])
      setGeranceIds([])
      setCompanyQuery("")
      setCompanyResults([])
    }
  }, [open])

  function toggleResidence(id: string, checked: boolean) {
    setResidencesIds((prev) => (checked ? [...prev, id] : prev.filter((r) => r !== id)))
  }

  function toggleGerance(id: string, checked: boolean) {
    setGeranceIds((prev) => (checked ? [...prev, id] : prev.filter((g) => g !== id)))
  }

  async function handleSearchCompany() {
    if (!companyQuery.trim()) return
    setSearching(true)
    try {
      const results = await searchCompanies(companyQuery)
      setCompanyResults(results)
      if (results.length === 0) toast.error("Aucun résultat pour cette recherche")
    } catch (err) {
      toast.error("Recherche impossible : " + (err as Error).message)
    } finally {
      setSearching(false)
    }
  }

  function handleApplyCompanyResult(result: CompanySearchResult) {
    setName(result.name)
    setStreet(result.address.street)
    setZipCode(result.address.zipCode)
    setCity(result.address.city)
    setSiret(result.siret)
    setCompanyResults([])
    setCompanyQuery("")
    toast.success("Informations reprises depuis la recherche - vérifiez avant d'enregistrer")
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit({
        name,
        service,
        siret,
        phone,
        mail,
        address: { ...emptyAddress, street, zipCode, city },
        web,
        residencesIds,
        geranceIds: isSuperAdmin ? geranceIds : [],
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
          <DialogHeader className="border-b border-[oklch(95%_0.003_100)] pb-4">
            <span className="text-[11.5px] font-bold tracking-wide text-primary uppercase">Contact</span>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-4 pl-[5px]">
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
            <div className="flex flex-col gap-2.5 rounded-[18px] border-[1.5px] border-dashed border-[oklch(78%_0.07_155)] bg-[oklch(98%_0.008_155)] p-[18px_20px]">
              <Label htmlFor="contact-company-search" className="font-bold">
                Rechercher l'entreprise{" "}
                <span className="font-medium text-muted-foreground">(SIREN, SIRET ou nom)</span>
              </Label>
              <div className="flex flex-wrap gap-2.5">
                <Input
                  id="contact-company-search"
                  placeholder="Rechercher (nom, SIRET, SIREN)…"
                  className="max-w-xs"
                  value={companyQuery}
                  onChange={(e) => setCompanyQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearchCompany())}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSearchCompany}
                  disabled={searching}
                  className="border-0 bg-[oklch(24%_0.03_155)] text-white hover:bg-[oklch(30%_0.04_155)]"
                >
                  <Search />
                  Rechercher
                </Button>
              </div>
              {companyResults.length > 0 && (
                <div className="flex flex-col gap-2">
                  {companyResults.map((result) => (
                    <div
                      key={result.siret || result.siren}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 p-2 text-sm"
                    >
                      <div>
                        <span className="font-medium">{result.name}</span>{" "}
                        <span className="text-muted-foreground">
                          {[result.siret, result.address.city].filter(Boolean).join(" · ")}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleApplyCompanyResult(result)}
                      >
                        Utiliser
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <p className="m-0 text-xs leading-relaxed text-[oklch(48%_0.06_155)]">
                Préremplit le nom, l'adresse et le SIRET ci-dessous - à vérifier avant d'enregistrer, ou à
                saisir/corriger manuellement sans passer par la recherche.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-siret">SIRET / SIREN</Label>
              <Input
                id="contact-siret"
                required
                placeholder="123 456 789 00012"
                value={siret}
                onChange={(e) => setSiret(e.target.value)}
              />
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
                <ZipCodeCityInput
                  id="contact-zip"
                  value={zipCode}
                  onChange={setZipCode}
                  onCityResolved={setCity}
                />
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
              <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-[18px] border border-[oklch(93%_0.005_100)] p-[10px]">
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
                      className="size-[17px] rounded border-input accent-primary"
                    />
                    {residence.name}
                  </label>
                ))}
              </div>
            </div>

            {isSuperAdmin && (
              <div className="flex flex-col gap-1.5">
                <Label>Gérances</Label>
                <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-[18px] border border-[oklch(93%_0.005_100)] p-[10px]">
                  {gerances.length === 0 && (
                    <p className="px-1 py-1 text-sm text-muted-foreground">Aucune gérance.</p>
                  )}
                  {gerances.map((gerance) => (
                    <label
                      key={gerance.id}
                      className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={geranceIds.includes(gerance.id)}
                        onChange={(e) => toggleGerance(gerance.id, e.target.checked)}
                        className="size-[17px] rounded border-input accent-primary"
                      />
                      {gerance.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
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
