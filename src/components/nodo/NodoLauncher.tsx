import { useState } from "react"
import { useAccountRole } from "@/hooks/useAccountRole"
import { NodoIcon } from "./NodoIcon"
import { NodoPanel } from "./NodoPanel"

const OPEN_STORAGE_KEY = "nodo-open"

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

function writeOpen(open: boolean) {
  try {
    localStorage.setItem(OPEN_STORAGE_KEY, open ? "1" : "0")
  } catch {
    // stockage indisponible (navigation privée...) : l'état n'est pas retenu
  }
}

// Bouton flottant de Nodo (assistant IA), en bas à droite de toutes les
// pages du BO. Réservé au superAdmin et aux comptes agence/agent d'un syndic
// rattachés à une gérance - même périmètre que nodo_send_message côté
// serveur, qui refuse de toute façon les autres comptes.
export function NodoLauncher() {
  const { isSuperAdmin, isAgence, isAgent, geranceId, serviceType, loading } = useAccountRole()
  const [open, setOpen] = useState(readOpen)

  const allowed = isSuperAdmin || ((isAgence || isAgent) && serviceType === "serviceSyndic" && !!geranceId)
  if (loading || !allowed) return null

  function toggle(next: boolean) {
    setOpen(next)
    writeOpen(next)
  }

  if (open) return <NodoPanel onClose={() => toggle(false)} />

  return (
    <button
      type="button"
      aria-label="Ouvrir Nodo, l'assistant IA"
      title="Nodo, l'assistant IA"
      onClick={() => toggle(true)}
      className="fixed right-5 bottom-5 z-40 flex size-14 items-center justify-center rounded-[18px] bg-[oklch(38%_0.07_152)] shadow-[0_10px_28px_-8px_oklch(30%_0.07_152/0.6)] transition-transform hover:scale-105 active:scale-95"
    >
      <NodoIcon className="size-8" color="white" />
    </button>
  )
}
