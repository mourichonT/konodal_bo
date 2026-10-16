import { Link } from "react-router-dom"
import { usePendingRemovalRequestsCount } from "@/hooks/usePendingRemovalRequestsCount"
import { cn } from "@/lib/utils"

// Bascule d'en-tête "Annuaire / Demandes de retrait" des pages Utilisateurs
// (superAdmin uniquement, comme la route /residents/retraits), avec le
// nombre de demandes de retrait en attente.
export function UsersSectionToggle({ current }: { current: "annuaire" | "retraits" }) {
  const pendingCount = usePendingRemovalRequestsCount(true)

  const item = (active: boolean) =>
    cn(
      "flex items-center gap-2 rounded-[12px] px-5 py-2.5 text-sm font-bold transition-colors",
      active
        ? "bg-white text-[oklch(22%_0.02_150)] shadow-[0_1px_4px_oklch(20%_0_0/0.12)]"
        : "text-[oklch(48%_0.01_150)] hover:text-[oklch(30%_0.01_150)]"
    )

  return (
    <div className="flex gap-1 rounded-[16px] bg-[oklch(93%_0.008_150)] p-[5px]">
      <Link to="/residents" className={item(current === "annuaire")}>
        Annuaire
      </Link>
      <Link to="/residents/retraits" className={item(current === "retraits")}>
        Demandes de retrait
        {pendingCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[oklch(58%_0.2_27)] px-1.5 text-[11.5px] font-extrabold text-white">
            {pendingCount}
          </span>
        )}
      </Link>
    </div>
  )
}
