import type { ReactNode } from "react"

// En-tête de page commun (modèle : Base de connaissances Nodo) : titre et
// description à gauche ; à droite, la bascule de vue (onglets) puis, dessous,
// les boutons d'action. Aligné en haut : la bascule reste à la même place,
// avec ou sans bouton. Sur un écran étroit, le bloc de droite passe sous le
// titre en restant aligné à droite.
export function PageHeader({
  title,
  description,
  toggle,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  toggle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">{title}</h1>
        {description && <p className="mt-1 max-w-[640px] text-[13.5px] text-muted-foreground">{description}</p>}
      </div>
      {(toggle || actions) && (
        <div className="ml-auto flex flex-col items-end gap-3">
          {toggle}
          {actions && <div className="flex flex-wrap justify-end gap-2.5">{actions}</div>}
        </div>
      )}
    </div>
  )
}
