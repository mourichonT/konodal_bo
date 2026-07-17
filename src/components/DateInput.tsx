import { useRef } from "react"
import { cn } from "@/lib/utils"

// <input type="date"> affiche son texte selon la locale du navigateur, pas
// celle de la page (Chrome ignore <html lang="fr"> pour ce contrôle) - on
// affiche donc nous-mêmes le format français dans un bouton, tout en gardant
// l'input natif (invisible) pour le sélecteur calendrier et la valeur.
export function DateInput({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function openPicker() {
    const input = inputRef.current
    if (!input) return
    try {
      input.showPicker()
    } catch {
      input.focus()
    }
  }

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={openPicker}
        className={cn(
          "h-8 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          className
        )}
      >
        {value ? new Date(`${value}T00:00:00`).toLocaleDateString("fr-FR") : "jj/mm/aaaa"}
      </button>
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
      />
    </div>
  )
}
