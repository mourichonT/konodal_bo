import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Pencil, Save } from "lucide-react"
import { AddressAutocompleteInput } from "@/components/AddressAutocompleteInput"
import { ZipCodeCityInput } from "@/components/ZipCodeCityInput"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AGENCY_NAME_MAX_LENGTH,
  FIELD_CLASS,
  OUTLINE_BUTTON_CLASS,
  ROW_BORDER_CLASS,
  TITLE_CLASS,
} from "@/components/agency/agencyUi"
import { updateGeranceAddress, updateGeranceName } from "@/lib/gerances"
import { cn, PANEL_CARD_CLASS, PRIMARY_CTA_CLASS } from "@/lib/utils"
import { emptyAddress } from "@/types/residence"
import type { Gerance } from "@/types/gerance"

// « Informations de l'agence » (vue Agence, onglet Général) : nom et adresse
// en lecture, « Modifier » les rend éditables dans la carte (compte agence
// seulement).
export function AgencyInfoCard({ gerance, canEdit }: { gerance: Gerance; canEdit: boolean }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(gerance.name)
  const [street, setStreet] = useState(gerance.address.street)
  const [zipCode, setZipCode] = useState(gerance.address.zipCode)
  const [city, setCity] = useState(gerance.address.city)
  const [saving, setSaving] = useState(false)

  function reset() {
    setName(gerance.name)
    setStreet(gerance.address.street)
    setZipCode(gerance.address.zipCode)
    setCity(gerance.address.city)
  }

  useEffect(() => {
    if (!editing) reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gerance.name, gerance.address.street, gerance.address.zipCode, gerance.address.city, editing])

  async function handleSave() {
    if (name.trim().length > AGENCY_NAME_MAX_LENGTH) {
      toast.error(`Le nom de l'agence ne peut pas dépasser ${AGENCY_NAME_MAX_LENGTH} caractères`)
      return
    }
    setSaving(true)
    try {
      await Promise.all([
        updateGeranceName(gerance.id, name),
        updateGeranceAddress(gerance.id, { ...emptyAddress, street, zipCode, city }),
      ])
      toast.success("Informations mises à jour")
      setEditing(false)
    } catch (err) {
      toast.error("Échec de l'enregistrement : " + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const rows = [
    { label: "Nom", value: gerance.name },
    { label: "Adresse", value: gerance.address.street },
    {
      label: "Code postal · Ville",
      value: [gerance.address.zipCode, gerance.address.city].filter(Boolean).join(" · "),
    },
  ]

  return (
    <section className={cn(PANEL_CARD_CLASS, "overflow-hidden p-0")}>
      <div className="flex items-center gap-3 px-[22px] pt-[18px] pb-3.5">
        <h2 className={cn(TITLE_CLASS, "flex-1 p-0 font-sans")}>Informations de l'agence</h2>
        {canEdit && !editing && (
          <Button type="button" variant="outline" className={OUTLINE_BUTTON_CLASS} onClick={() => setEditing(true)}>
            <Pencil />
            Modifier
          </Button>
        )}
      </div>

      {editing ? (
        <div className={cn(ROW_BORDER_CLASS, "flex flex-col gap-4 px-[22px] py-4")}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agency-name">Nom de l'agence</Label>
            <Input
              id="agency-name"
              required
              maxLength={AGENCY_NAME_MAX_LENGTH}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={FIELD_CLASS}
            />
            {name.length >= AGENCY_NAME_MAX_LENGTH && (
              <p className="m-0 text-xs text-red-600">Limite de {AGENCY_NAME_MAX_LENGTH} caractères atteinte</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agency-street">Adresse</Label>
            <AddressAutocompleteInput
              id="agency-street"
              value={street}
              onChange={setStreet}
              onSelect={(a) => {
                setStreet(a.street)
                setZipCode(a.zipCode)
                setCity(a.city)
              }}
              className={FIELD_CLASS}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agency-zip">Code postal</Label>
              <ZipCodeCityInput
                id="agency-zip"
                value={zipCode}
                onChange={setZipCode}
                onCityResolved={setCity}
                className={FIELD_CLASS}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agency-city">Ville</Label>
              <Input id="agency-city" value={city} onChange={(e) => setCity(e.target.value)} className={FIELD_CLASS} />
            </div>
          </div>
          <div className="flex justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-[12px] px-4 font-bold"
              disabled={saving}
              onClick={() => {
                reset()
                setEditing(false)
              }}
            >
              Annuler
            </Button>
            <Button
              type="button"
              className={cn(PRIMARY_CTA_CLASS, "h-10 rounded-[12px] px-5 font-bold")}
              onClick={handleSave}
              disabled={saving || !name.trim()}
            >
              <Save />
              Enregistrer
            </Button>
          </div>
        </div>
      ) : (
        <dl className="m-0">
          {rows.map((row) => (
            <div
              key={row.label}
              className={cn(
                ROW_BORDER_CLASS,
                "flex flex-col gap-0.5 px-[22px] py-3 text-[13.5px] sm:flex-row sm:gap-0"
              )}
            >
              <dt className="text-muted-foreground sm:w-[180px] sm:shrink-0">{row.label}</dt>
              <dd className="m-0 min-w-0 font-semibold break-words text-[oklch(22%_0.01_150)]">{row.value || "—"}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
