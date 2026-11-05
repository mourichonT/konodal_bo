import type { ComponentProps } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { TableHead } from "@/components/ui/table"
import type { SortHeadProps } from "@/hooks/useTableSort"
import { cn } from "@/lib/utils"

// En-tête de colonne triable (useTableSort) : flèche haut/bas selon le sens
// actif, double flèche estompée sinon.
export function SortableTableHead({
  direction,
  title,
  onSort,
  children,
  ...props
}: SortHeadProps & ComponentProps<typeof TableHead>) {
  const Icon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown
  return (
    <TableHead
      aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}
      {...props}
    >
      <button
        type="button"
        onClick={onSort}
        title={title}
        className={cn(
          "-mx-1 inline-flex items-center gap-1 rounded px-1 [letter-spacing:inherit] [text-transform:inherit] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          direction && "text-foreground"
        )}
      >
        {children}
        <Icon className={cn("size-3.5 shrink-0", !direction && "opacity-40")} />
      </button>
    </TableHead>
  )
}
