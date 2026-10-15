import { Input } from "@/components/ui/input"

// "Lots : de [X] à [Y]" - bornes incluses, champ vide = pas de borne.
export function NumberRangeFilter({
  label,
  min,
  max,
  onMinChange,
  onMaxChange,
}: {
  label: string
  min: string
  max: string
  onMinChange: (value: string) => void
  onMaxChange: (value: string) => void
}) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <span>{label} : de</span>
      <Input
        type="number"
        min={0}
        inputMode="numeric"
        value={min}
        onChange={(e) => onMinChange(e.target.value)}
        className="h-9 w-20"
        aria-label={`${label} minimum`}
      />
      <span>à</span>
      <Input
        type="number"
        min={0}
        inputMode="numeric"
        value={max}
        onChange={(e) => onMaxChange(e.target.value)}
        className="h-9 w-20"
        aria-label={`${label} maximum`}
      />
    </div>
  )
}
