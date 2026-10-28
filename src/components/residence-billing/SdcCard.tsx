import { useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Building2, FileText, Pencil, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { searchCompanies, type CompanySearchResult } from "@/lib/companySearch"
import {
  createCsInvoiceSubscription,
  updateCsCustomer,
  type CsBillingAdmin,
  type CsCustomerInput,
} from "@/lib/csAvance"
import { PRIMARY_CTA_CLASS } from "@/lib/utils"
import type { Residence } from "@/types/residence"
import { ConfirmActionDialog } from "./ConfirmActionDialog"

function defaults(data: CsBillingAdmin, residence: Residence): CsCustomerInput {
  const customer = data.customer
  const address = customer?.address
  return {
    name: customer?.name || `Syndicat des copropriétaires ${residence.name}`.trim(),
    email: customer?.email ?? "",
    address: {
      line1: address?.line1 ?? residence.address?.street ?? "",
      line2: address?.line2 ?? residence.address?.complement ?? "",
      postal_code: address?.postal_code ?? residence.address?.zipCode ?? "",
      city: address?.city ?? residence.address?.city ?? "",
    },
    siret: customer?.siret ?? "",
  }
}

// Syndicat des copropriétaires : identité sur les factures (client Stripe de
// la résidence) et passage en abonnement annuel sur facture.
export function SdcCard({
  residenceId,
  residence,
  data,
  onChanged,
}: {
  residenceId: string
  residence: Residence
  data: CsBillingAdmin
  onChanged: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<CsCustomerInput>(() => defaults(data, residence))
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<CompanySearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [confirmInvoice, setConfirmInvoice] = useState(false)
  const customer = data.customer
  const complete = !!(customer?.name && customer.email && customer.address.line1 && customer.address.postal_code && customer.address.city)
  const subscribed = data.subscription?.subscribed ?? false

  function openEditor() {
    setForm(defaults(data, residence))
    setSearch("")
    setResults([])
    setEditing(true)
  }

  async function runSearch() {
    setSearching(true)
    try {
      setResults(await searchCompanies(search || `syndicat copropriétaires ${residence.name}`))
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSearching(false)
    }
  }

  function pick(company: CompanySearchResult) {
    setForm((current) => ({
      ...current,
      name: company.name || current.name,
      siret: company.siret || current.siret,
      address: {
        ...current.address,
        line1: company.address.street || current.address.line1,
        postal_code: company.address.zipCode || current.address.postal_code,
        city: company.address.city || current.address.city,
      },
    }))
    setResults([])
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      await updateCsCustomer(residenceId, form)
      toast.success("Syndicat des copropriétaires enregistré")
      setEditing(false)
      await onChanged()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const setAddress = (key: keyof CsCustomerInput["address"], value: string) =>
    setForm((current) => ({ ...current, address: { ...current.address, [key]: value } }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Syndicat des copropriétaires</CardTitle>
        <CardDescription>Identité sur les factures de l'option CS avancé.</CardDescription>
        <CardAction>
          <Button type="button" variant="outline" size="sm" onClick={openEditor}>
            <Pencil />
            Modifier
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {customer ? (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Nom</dt>
              <dd className="font-medium">{customer.name || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email de facturation</dt>
              <dd className="font-medium">{customer.email || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Adresse</dt>
              <dd className="font-medium">
                {[customer.address.line1, customer.address.line2, [customer.address.postal_code, customer.address.city].filter(Boolean).join(" ")]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">SIRET</dt>
              <dd className="font-medium tabular-nums">{customer.siret || "—"}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-muted-foreground">
            Pas encore renseigné : créé à la première souscription, ou dès maintenant avec « Modifier ».
          </p>
        )}
        {!subscribed && (
          <div className="flex flex-wrap items-center gap-3 border-t pt-4">
            <Button
              type="button"
              disabled={!complete}
              className={PRIMARY_CTA_CLASS}
              onClick={() => setConfirmInvoice(true)}
            >
              <FileText />
              Abonnement annuel sur facture
            </Button>
            <span className="text-xs text-muted-foreground">
              {complete
                ? "Facture annuelle au syndicat, à régler par virement sous 30 jours."
                : "Renseignez d'abord le nom, l'email et l'adresse."}
            </span>
          </div>
        )}
      </CardContent>

      <Dialog open={editing} onOpenChange={(next) => !saving && setEditing(next)}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={save} className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4">
            <DialogHeader className="pb-2">
              <span className="text-[11.5px] font-bold tracking-wide text-muted-foreground uppercase">Facturation</span>
              <DialogTitle>Syndicat des copropriétaires</DialogTitle>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden pr-4 pl-[5px]">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sdc-search">Rechercher le SIRET (annuaire des entreprises)</Label>
                <div className="flex gap-2">
                  <Input
                    id="sdc-search"
                    placeholder={`Syndicat copropriétaires ${residence.name}`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        void runSearch()
                      }
                    }}
                  />
                  <Button type="button" variant="outline" disabled={searching} onClick={runSearch}>
                    <Search />
                  </Button>
                </div>
                {results.length > 0 && (
                  <ul className="flex flex-col overflow-hidden rounded-lg border">
                    {results.map((company) => (
                      <li key={company.siret || company.siren}>
                        <button
                          type="button"
                          onClick={() => pick(company)}
                          className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          <span className="flex flex-col">
                            <span className="font-medium">{company.name}</span>
                            <span className="text-xs text-muted-foreground">
                              SIRET {company.siret || "—"} · {company.address.zipCode} {company.address.city}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sdc-name">Nom</Label>
                <Input id="sdc-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sdc-email">Email de facturation</Label>
                <Input
                  id="sdc-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sdc-line1">Adresse</Label>
                <Input id="sdc-line1" required value={form.address.line1} onChange={(e) => setAddress("line1", e.target.value)} />
                <Input
                  placeholder="Complément (facultatif)"
                  value={form.address.line2}
                  onChange={(e) => setAddress("line2", e.target.value)}
                />
                <div className="flex gap-2">
                  <Input
                    className="w-28"
                    placeholder="Code postal"
                    required
                    value={form.address.postal_code}
                    onChange={(e) => setAddress("postal_code", e.target.value)}
                  />
                  <Input placeholder="Ville" required value={form.address.city} onChange={(e) => setAddress("city", e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sdc-siret">SIRET (facultatif, affiché sur les factures)</Label>
                <Input
                  id="sdc-siret"
                  inputMode="numeric"
                  value={form.siret}
                  onChange={(e) => setForm({ ...form, siret: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={saving} onClick={() => setEditing(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving} className={PRIMARY_CTA_CLASS}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={confirmInvoice}
        onOpenChange={setConfirmInvoice}
        title="Créer l'abonnement annuel sur facture ?"
        description={
          <>
            L'option est active tout de suite. La facture annuelle est émise et envoyée à {customer?.email ?? "le syndicat"}
            {data.grant?.until ? ", à la fin de l'offre en cours" : ""}, à régler sous 30 jours
            {data.reservedDiscount ? ", avec la remise réservée" : ""}.
          </>
        }
        confirmLabel="Créer l'abonnement"
        onConfirm={async () => {
          try {
            await createCsInvoiceSubscription(residenceId)
            toast.success("Abonnement sur facture créé")
            await onChanged()
          } catch (err) {
            toast.error((err as Error).message)
          }
        }}
      />
    </Card>
  )
}
