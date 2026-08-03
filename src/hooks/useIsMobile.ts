import { useEffect, useState } from "react"

// Même seuil que le reste du BO (tiroir de menu, grilles empilées) - sous
// 768px (breakpoint `md` de Tailwind), pas seulement au chargement : suit
// les changements d'orientation/redimensionnement via matchMedia plutôt
// qu'un simple useState figé.
const QUERY = "(max-width: 767px)"

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(QUERY).matches)

  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    const handler = () => setIsMobile(mql.matches)
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [])

  return isMobile
}
