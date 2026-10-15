import { useState } from "react"
import { Check, ChevronDown } from "lucide-react"
import { Popover } from "@base-ui/react/popover"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// Filtre à choix multiples des barres de filtres (villes, annonceurs...) :
// même popover que SearchableSelect (portail base-ui, jamais rogné par une
// Card), avec un champ de recherche et une case par option. Aucune option
// cochée = pas de filtre.
export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  allLabel = "Toutes",
  placeholder = "Rechercher…",
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  allLabel?: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const normalizedQuery = query.trim().toLowerCase()
  const visible = normalizedQuery ? options.filter((o) => o.toLowerCase().includes(normalizedQuery)) : options
  const summary =
    selected.length === 0 ? allLabel : selected.length === 1 ? selected[0] : `${selected.length} sélections`

  function toggle(option: string) {
    onChange(selected.includes(option) ? selected.filter((o) => o !== option) : [...selected, option])
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery("")
      }}
    >
      <Popover.Trigger className="flex h-9 max-w-64 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className="truncate">
          {label} : {summary}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className="z-20 outline-none" align="start" side="bottom" sideOffset={4}>
          <Popover.Popup className="w-64 overflow-hidden rounded-lg border bg-white shadow-lg">
            <div className="border-b p-1.5">
              <Input
                autoFocus
                placeholder={placeholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-7"
              />
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {visible.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Aucun résultat.</p>}
              {visible.map((option) => {
                const checked = selected.includes(option)
                return (
                  <button
                    key={option}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => toggle(option)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded border border-input",
                        checked && "border-primary bg-primary text-primary-foreground"
                      )}
                    >
                      {checked && <Check className="size-3" />}
                    </span>
                    <span className="truncate">{option}</span>
                  </button>
                )
              })}
            </div>
            {selected.length > 0 && (
              <div className="border-t p-1.5">
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="w-full rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted"
                >
                  Tout désélectionner
                </button>
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
