import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

// CTA commun des barres de filtres : toujours en dernier, aligné à droite
// (ml-auto), grisé tant qu'aucun filtre n'est actif.
export function ClearFiltersButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" className="ml-auto" disabled={!active} onClick={onClick}>
      <X />
      Effacer les filtres
    </Button>
  )
}
