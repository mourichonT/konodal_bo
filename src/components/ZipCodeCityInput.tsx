import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { searchCitiesByZipCode } from "@/lib/addressSearch"

// Remplace le champ "Code postal" brut : dès que 5 chiffres sont saisis,
// interroge geo.api.gouv.fr pour la/les commune(s) correspondante(s) et
// pré-remplit la ville - un seul résultat se remplit tout seul, plusieurs
// (code postal partagé par plusieurs communes) affichent une liste à
// choisir, aucun résultat laisse la ville telle quelle (saisie manuelle).
export function ZipCodeCityInput({
  id,
  value,
  onChange,
  onCityResolved,
  required,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  onCityResolved: (city: string) => void
  required?: boolean
}) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  function handleChange(next: string) {
    onChange(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setOpen(false)
    if (!/^\d{5}$/.test(next.trim())) {
      setSuggestions([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const cities = await searchCitiesByZipCode(next)
        if (cities.length === 1) {
          onCityResolved(cities[0])
          setSuggestions([])
          setOpen(false)
        } else if (cities.length > 1) {
          setSuggestions(cities)
          setOpen(true)
        } else {
          setSuggestions([])
        }
      } catch {
        setSuggestions([])
        setOpen(false)
      }
    }, 300)
  }

  return (
    <div className="relative">
      <Input
        id={id}
        required={required}
        autoComplete="off"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      {open && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-white py-1 shadow-lg">
          {suggestions.map((city) => (
            <button
              key={city}
              type="button"
              className="block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-muted"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onCityResolved(city)
                setOpen(false)
              }}
            >
              {city}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
