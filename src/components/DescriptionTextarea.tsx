import { cn } from "@/lib/utils"

// Limite partagée par tous les champs "Description" du BO (communication,
// intervention, compte-rendu...) - demandé explicitement, avec un compteur
// visible sous le champ plutôt qu'une simple troncature silencieuse.
export const DESCRIPTION_MAX_LENGTH = 850

export function DescriptionTextarea({
  id,
  value,
  onChange,
  rows = 4,
  required,
  disabled,
  className,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  rows?: number
  required?: boolean
  disabled?: boolean
  className?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <textarea
        id={id}
        required={required}
        disabled={disabled}
        rows={rows}
        maxLength={DESCRIPTION_MAX_LENGTH}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          className
        )}
      />
      <span className="self-end text-xs text-muted-foreground">
        {value.length}/{DESCRIPTION_MAX_LENGTH}
      </span>
    </div>
  )
}
