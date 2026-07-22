import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { searchAddresses, type AddressSearchResult } from "@/lib/addressSearch"

// Remplace le champ "Adresse" brut dans tous les formulaires qui portent un
// Address (résidence, gérance, contact) - tape une adresse, choisit une
// suggestion (API Adresse, data.gouv.fr/IGN, gratuite et sans clé), et
// street/zipCode/city se remplissent d'un coup via onSelect. Le champ reste
// un simple texte libre si l'utilisateur ignore les suggestions et tape
// directement (onChange normal, jamais bloqué par la recherche).
export function AddressAutocompleteInput({
  id,
  value,
  onChange,
  onSelect,
  required,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  onSelect: (address: { street: string; zipCode: string; city: string }) => void
  required?: boolean
}) {
  const [suggestions, setSuggestions] = useState<AddressSearchResult[]>([])
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
    if (next.trim().length < 3) {
      setSuggestions([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchAddresses(next)
        setSuggestions(results)
        setOpen(results.length > 0)
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
        // onMouseDown sur les options (plus bas) empêche ce blur de se
        // déclencher avant le clic - sans ça, la liste se ferme avant que
        // le onClick de la suggestion n'ait le temps de s'exécuter.
        onBlur={() => setOpen(false)}
      />
      {open && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-white py-1 shadow-lg">
          {suggestions.map((result) => (
            <button
              key={result.id}
              type="button"
              className="block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-muted"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(result)
                setOpen(false)
              }}
            >
              {result.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
