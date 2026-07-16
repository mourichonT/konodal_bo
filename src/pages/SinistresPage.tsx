import { NavLink, Outlet } from "react-router-dom"
import { toast } from "sonner"
import { useAllSinistres, type SinistreWithResidence } from "@/hooks/useAllSinistres"
import { cn } from "@/lib/utils"

export type SinistresOutletContext = {
  sinistres: SinistreWithResidence[]
  loading: boolean
}

const tabs = [
  { to: "kanban", label: "Tableau Kanban" },
  { to: "liste", label: "Liste" },
]

export default function SinistresPage() {
  const { sinistres, loading } = useAllSinistres((message) => toast.error(message))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sinistres</h1>
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>

      <Outlet context={{ sinistres, loading } satisfies SinistresOutletContext} />
    </div>
  )
}
