import { useEffect } from "react"

// Police dédiée aux pages publiques de la "Refonte offres 2026"
// (OfferPage, SharedInterventionPage) - chargée à la volée plutôt qu'injectée
// globalement dans index.css, qui garde Roboto pour le reste du BO.
export function useManropeFont() {
  useEffect(() => {
    const preconnect = document.createElement("link")
    preconnect.rel = "preconnect"
    preconnect.href = "https://fonts.googleapis.com"
    const stylesheet = document.createElement("link")
    stylesheet.rel = "stylesheet"
    stylesheet.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
    document.head.append(preconnect, stylesheet)
    return () => {
      preconnect.remove()
      stylesheet.remove()
    }
  }, [])
}
