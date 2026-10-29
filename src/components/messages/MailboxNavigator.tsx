import { useMemo, useState } from "react"
import { Building2, Inbox, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { Residence } from "@/types/residence"

function fold(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

function FolderItem({
  icon: Icon,
  label,
  count,
  unread = 0,
  active,
  muted,
  onClick,
}: {
  icon: typeof Inbox
  label: string
  count: number
  // Messages non lus : pastille et libellé en gras, à la place du total.
  unread?: number
  active: boolean
  muted?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[oklch(96%_0.005_100)]",
        active && "bg-[oklch(94%_0.03_155)] font-semibold text-[oklch(32%_0.07_155)] hover:bg-[oklch(94%_0.03_155)]",
        muted && !active && "text-muted-foreground"
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className={cn("min-w-0 flex-1 truncate", unread > 0 && "font-bold")}>{label}</span>
      {unread > 0 ? (
        <span className="rounded-full bg-[oklch(45%_0.1_155)] px-1.5 text-[11px] font-bold text-white tabular-nums">
          {unread}
        </span>
      ) : (
        count > 0 && <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      )}
    </button>
  )
}

// Colonne de gauche de la page Messages (comme la GED) : toutes les
// résidences, puis chaque résidence avec son nombre de messages ; celles
// sans message sont repliées.
export function MailboxNavigator({
  residences,
  counts,
  unread,
  total,
  selectedId,
  onSelect,
}: {
  residences: Residence[]
  counts: Record<string, number>
  unread: Record<string, number>
  total: number
  selectedId: string | null
  onSelect: (residenceId: string | null) => void
}) {
  const [query, setQuery] = useState("")
  const [showEmpty, setShowEmpty] = useState(false)
  const sorted = useMemo(
    () => [...residences].sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true })),
    [residences]
  )
  const q = fold(query.trim())
  const matching = q ? sorted.filter((r) => fold(`${r.name} ${r.address?.city ?? ""}`).includes(q)) : sorted
  const withMail = matching.filter((r) => (counts[r.id] ?? 0) > 0 || (unread[r.id] ?? 0) > 0 || r.id === selectedId)
  const empty = matching.filter((r) => !withMail.includes(r))

  return (
    <nav className="flex min-w-0 flex-col gap-3">
      <FolderItem
        icon={Inbox}
        label="Toutes les résidences"
        count={total}
        unread={Object.values(unread).reduce((sum, n) => sum + n, 0)}
        active={selectedId === null}
        onClick={() => onSelect(null)}
      />
      <div className="h-px bg-border" />
      <p className="px-2 text-sm font-bold">
        Résidences <span className="font-normal text-muted-foreground">· {residences.length}</span>
      </p>
      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une résidence…"
          className="pl-8"
        />
      </div>
      <div className="flex flex-col gap-0.5">
        {withMail.map((r) => (
          <FolderItem
            key={r.id}
            icon={Building2}
            label={r.name}
            count={counts[r.id] ?? 0}
            unread={unread[r.id] ?? 0}
            active={r.id === selectedId}
            onClick={() => onSelect(r.id)}
          />
        ))}
        {withMail.length === 0 && <p className="px-2 text-xs text-muted-foreground">Aucun message.</p>}
        {empty.length > 0 &&
          (showEmpty || q ? (
            empty.map((r) => (
              <FolderItem
                key={r.id}
                icon={Building2}
                label={r.name}
                count={0}
                muted
                active={r.id === selectedId}
                onClick={() => onSelect(r.id)}
              />
            ))
          ) : (
            <button
              type="button"
              onClick={() => setShowEmpty(true)}
              className="px-2 py-1 text-left text-xs font-semibold text-[oklch(42%_0.08_155)] hover:underline"
            >
              {empty.length} résidence{empty.length > 1 ? "s" : ""} sans message
            </button>
          ))}
      </div>
    </nav>
  )
}
