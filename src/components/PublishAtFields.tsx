import { DateInput } from "@/components/DateInput"
import { Input } from "@/components/ui/input"
import { toDateField } from "@/lib/publishAt"

// « Le jj/mm/aaaa à hh:mm » : date et heure de publication d'une
// communication programmée (formulaire Communiquer, changement d'heure).
export function PublishAtFields({
  date,
  time,
  onDateChange,
  onTimeChange,
  disabled,
}: {
  date: string
  time: string
  onDateChange: (value: string) => void
  onTimeChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Le</span>
      <DateInput value={date} onChange={onDateChange} min={toDateField(new Date())} />
      <span className="text-muted-foreground">à</span>
      <Input
        type="time"
        value={time}
        onChange={(e) => onTimeChange(e.target.value)}
        disabled={disabled}
        aria-label="Heure de publication"
        className="w-28"
      />
    </div>
  )
}
