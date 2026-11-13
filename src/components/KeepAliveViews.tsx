import { useState, type ReactNode } from "react"

// Vues d'une section à onglets (Utilisateurs, Contenus…) : une vue ouverte
// reste montée, masquée quand on bascule sur une autre. Revenir dessus est
// immédiat (ni rechargement des données, ni filtres perdus), comme dans la
// Base de connaissances Nodo où seul le contenu change sous l'en-tête.
export function KeepAliveViews<K extends string>({
  active,
  views,
}: {
  active: K
  // Vues disponibles (une vue absente, par exemple réservée au superAdmin
  // pendant le chargement du rôle, n'est pas affichée).
  views: Partial<Record<K, ReactNode>>
}) {
  const [visited, setVisited] = useState<ReadonlySet<K>>(() => new Set([active]))
  // Ajustement pendant le rendu (motif React « state dérivé ») : la vue
  // ouverte pour la première fois s'affiche dès ce rendu.
  if (!visited.has(active)) setVisited(new Set([...visited, active]))

  return (
    <>
      {(Object.keys(views) as K[]).map((key) =>
        visited.has(key) || key === active ? (
          <div key={key} className={key === active ? undefined : "hidden"}>
            {views[key]}
          </div>
        ) : null
      )}
    </>
  )
}
