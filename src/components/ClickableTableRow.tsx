import * as React from "react"
import { useHref, useNavigate, type To } from "react-router-dom"

import { TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

// Ligne de tableau qui fait comme son bouton d'action (Gérer, Voir…) quand on
// clique n'importe où dessus. À n'utiliser que pour une ligne qui n'a qu'une
// action : sans `to` ni `onActivate`, c'est une ligne ordinaire. Le bouton
// reste affiché, pour le clavier et les lecteurs d'écran.
// Un lien, un bouton ou un champ de la ligne garde son propre effet, une
// sélection de texte n'ouvre rien, et Ctrl/⌘-clic ou le clic molette ouvrent
// un nouvel onglet.
const INTERACTIVE =
  "a, button, input, select, textarea, label, [role='button'], [role='checkbox'], [role='switch'], [role='menuitem'], [contenteditable='true']"

type ClickableTableRowProps = React.ComponentProps<typeof TableRow> & {
  to?: To
  state?: unknown
  onActivate?: () => void
}

export function ClickableTableRow({
  to,
  state,
  onActivate,
  className,
  onClick,
  onAuxClick,
  ...props
}: ClickableTableRowProps) {
  const navigate = useNavigate()
  const href = useHref(to ?? ".")

  if (to === undefined && !onActivate) {
    return <TableRow className={className} onClick={onClick} onAuxClick={onAuxClick} {...props} />
  }

  function ignored(e: React.MouseEvent<HTMLTableRowElement>) {
    const row = e.currentTarget
    const target = e.target as Element
    // Un clic dans une fenêtre (Dialog) ouverte depuis la ligne remonte par
    // l'arbre React sans être dans la ligne.
    if (!row.contains(target)) return true
    const control = target.closest(INTERACTIVE)
    if (control && row.contains(control)) return true
    return !!window.getSelection()?.toString()
  }

  function openInNewTab() {
    window.open(href, "_blank", "noopener")
  }

  return (
    <TableRow
      className={cn("cursor-pointer", className)}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented || ignored(e)) return
        if (to === undefined) onActivate?.()
        else if (e.ctrlKey || e.metaKey) openInNewTab()
        else navigate(to, { state })
      }}
      onAuxClick={(e) => {
        onAuxClick?.(e)
        if (e.button !== 1 || to === undefined || e.defaultPrevented || ignored(e)) return
        e.preventDefault()
        openInNewTab()
      }}
      {...props}
    />
  )
}
