import { Outlet } from "react-router-dom"
import { Sidebar } from "./Sidebar"

export function AppLayout() {
  return (
    <div className="flex h-svh gap-[10px] overflow-hidden bg-accent/20 p-[10px]">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
