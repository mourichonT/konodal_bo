import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Popover } from "@base-ui/react/popover"
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
//
// Le menu passe par Popover.Portal/Positioner (base-ui) plutôt qu'un simple
// <div absolute> dans le flux normal : un menu positionné "en place" se fait
// rogner par le premier ancêtre overflow-hidden qu'il traverse (ex: Card,
// qui l'a par défaut pour ses coins arrondis) - le portail sort entièrement
// du flux/de l'empilement du parent, qui n'a alors plus aucune prise dessus.
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
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery("")
      }}
    >
      <Popover.Trigger
        id={id}
        disabled={disabled}
        className={cn(
          "flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
          className
        )}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected?.label ?? emptyLabel}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className="z-20 outline-none" align="start" side="bottom" sideOffset={4}>
          <Popover.Popup className="w-(--anchor-width) overflow-hidden rounded-lg border bg-white shadow-lg">
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
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
