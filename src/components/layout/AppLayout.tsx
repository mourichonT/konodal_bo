import { useEffect, useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { Menu } from "lucide-react"
import logoGreen from "@/assets/logo_transparent-green.png"
import { Sidebar } from "./Sidebar"

export function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const location = useLocation()

  // Referme le tiroir de navigation mobile a chaque changement de route -
  // sans ca, il resterait ouvert par-dessus la page suivante apres un clic
  // sur un lien du menu.
  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  return (
    <div className="flex h-svh gap-[10px] overflow-hidden pr-[10px]" style={{ background: "oklch(98% 0.003 100)" }}>
      {/* `contents` : la Sidebar reste un enfant direct de ce flex row a
          partir de md (gap/largeur strictement identiques a avant ce lot),
          simplement retiree du flux en dessous - remplacee par le tiroir
          ci-dessous. */}
      <div className="hidden md:contents">
        <Sidebar />
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 bg-[oklch(20%_0.01_150/0.45)] duration-150 animate-in fade-in-0"
          />
          <div className="absolute inset-y-0 left-0 py-[10px] pl-[10px] duration-150 animate-in slide-in-from-left-4">
            <Sidebar />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-[oklch(93%_0.005_100)] px-4 py-3 md:hidden">
          <button
            type="button"
            aria-label="Ouvrir le menu"
            onClick={() => setMobileNavOpen(true)}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[oklch(35%_0.01_150)] hover:bg-[oklch(95%_0.005_100)]"
          >
            <Menu className="size-5" />
          </button>
          <img src={logoGreen} alt="Konodal" className="h-5 w-auto" />
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
