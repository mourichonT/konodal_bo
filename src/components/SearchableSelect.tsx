import { useEffect, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type SearchableSelectOption = {
  value: string
  label: string
  disabled?: boolean
}

export type SearchableSelectGroup = {
  // Sans label = groupe "plat", pas d'en-tête affiché (cas le plus courant :
  // un seul groupe implicite passé sous forme de liste d'options simples).
  label?: string
  options: SearchableSelectOption[]
}

// Remplace un <select> natif partout où la liste peut être longue
// (résidences, gérances, contacts...) - même API value/onChange contrôlée
// qu'un select classique, plus un champ de recherche qui filtre les options
// affichées. `groups` accepte soit une liste à plat (un seul groupe sans
// label), soit plusieurs groupes avec en-tête (équivalent <optgroup>).
export function SearchableSelect({
  id,
  value,
  onChange,
  groups,
  placeholder = "Rechercher…",
  emptyLabel = "Choisir…",
  noResultsLabel = "Aucun résultat.",
  disabled,
  className,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  groups: SearchableSelectGroup[]
  placeholder?: string
  emptyLabel?: string
  noResultsLabel?: string
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  const selected = groups.flatMap((g) => g.options).find((o) => o.value === value)

  const normalizedQuery = query.trim().toLowerCase()
  const filteredGroups = normalizedQuery
    ? groups
        .map((g) => ({
          ...g,
          options: g.options.filter((o) => o.label.toLowerCase().includes(normalizedQuery)),
        }))
        .filter((g) => g.options.length > 0)
    : groups
  const hasResults = filteredGroups.some((g) => g.options.length > 0)

  function handleSelect(option: SearchableSelectOption) {
    if (option.disabled) return
    onChange(option.value)
    setQuery("")
    setOpen(false)
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected?.label ?? emptyLabel}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border bg-white shadow-lg">
          <div className="border-b p-1.5">
            <Input
              autoFocus
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-7"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {!hasResults && <p className="px-3 py-2 text-sm text-muted-foreground">{noResultsLabel}</p>}
            {filteredGroups.map((group, i) => (
              <div key={group.label ?? i}>
                {group.label && (
                  <p className="px-3 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">{group.label}</p>
                )}
                {group.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={option.disabled}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(option)}
                    className={cn(
                      "block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-muted disabled:pointer-events-none disabled:text-muted-foreground",
                      option.value === value && "bg-muted font-medium"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
