import { Outlet } from "react-router-dom"
import { Sidebar } from "./Sidebar"

export function AppLayout() {
  return (
    <div className="flex h-svh gap-[10px] overflow-hidden pr-[10px]" style={{ background: "oklch(98% 0.003 100)" }}>
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
