import { Link } from "react-router-dom"
import { UserX, Users } from "lucide-react"
import { usePendingRemovalRequestsCount } from "@/hooks/usePendingRemovalRequestsCount"
import { cn } from "@/lib/utils"

// Bascule d'en-tête "Annuaire / Demandes de retrait" des pages Utilisateurs
// (superAdmin uniquement, comme la route /residents/retraits), avec le
// nombre de demandes de retrait en attente. Même style que le switch
// Kanban / Liste des sinistres (SinistresPage).
export function UsersSectionToggle({ current }: { current: "annuaire" | "retraits" }) {
  const pendingCount = usePendingRemovalRequestsCount(true)

  const item = (active: boolean) =>
    cn(
      "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors sm:gap-2 sm:px-[22px] sm:py-[11px] sm:text-[14.5px]",
      active
        ? "bg-[oklch(45%_0.1_155)] font-bold text-white shadow-[0_6px_16px_-6px_oklch(38%_0.08_155/0.5)]"
        : "text-[oklch(45%_0.01_150)] hover:bg-[oklch(98%_0.003_100)]"
    )

  return (
    <div className="flex items-center gap-1 rounded-2xl bg-[oklch(93%_0.005_100)] p-1.5 sm:gap-[5px]">
      <Link to="/residents" className={item(current === "annuaire")}>
        <Users className="size-3.5 sm:size-4" />
        Annuaire
      </Link>
      <Link to="/residents/retraits" className={item(current === "retraits")}>
        <UserX className="size-3.5 sm:size-4" />
        <span className="sm:hidden">Retraits</span>
        <span className="hidden sm:inline">Demandes de retrait</span>
        {pendingCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[oklch(58%_0.2_27)] px-1.5 text-[11.5px] font-extrabold text-white">
            {pendingCount}
          </span>
        )}
      </Link>
    </div>
  )
}
