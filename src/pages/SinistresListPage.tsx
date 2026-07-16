import { Link, useOutletContext } from "react-router-dom"
import { Eye } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SinistreThumbnail } from "@/components/SinistreThumbnail"
import { sinistreStatusLabels, type SinistreStatus } from "@/types/sinistre"
import type { SinistresOutletContext } from "@/pages/SinistresPage"

const statusBadgeClass: Record<SinistreStatus, string> = {
  "Non envoyé": "border-transparent bg-slate-100 text-slate-800",
  Transmis: "border-transparent bg-amber-100 text-amber-800",
  "En cours": "border-transparent bg-sky-100 text-sky-800",
  Terminé: "border-transparent bg-emerald-100 text-emerald-800",
}

export default function SinistresListPage() {
  const { sinistres, loading } = useOutletContext<SinistresOutletContext>()

  return (
    <Card className="rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
      <CardContent className="flex flex-col">
        <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>N° ticket</TableHead>
                <TableHead>Photo</TableHead>
                <TableHead>Titre</TableHead>
                <TableHead>Résidence</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sinistres.map((sinistre) => {
                const statut = (sinistre.statut || "Non envoyé") as SinistreStatus
                return (
                  <TableRow key={`${sinistre.residenceId}-${sinistre.id}`}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      #{sinistre.id.slice(-6).toUpperCase()}
                    </TableCell>
                    <TableCell>
                      <SinistreThumbnail pathImage={sinistre.pathImage} className="size-10 rounded-md" />
                    </TableCell>
                    <TableCell className="font-medium">{sinistre.title || "Sans titre"}</TableCell>
                    <TableCell>{sinistre.residenceName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusBadgeClass[statut] ?? statusBadgeClass["Non envoyé"]}>
                        {sinistreStatusLabels[statut] ?? statut}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        render={<Link to={`/sinistres/${sinistre.residenceId}/${sinistre.id}`} />}
                      >
                        <Eye />
                        Voir
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
              {!loading && sinistres.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Aucun sinistre pour l'instant.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          {sinistres.length} sinistre{sinistres.length > 1 ? "s" : ""} au total
        </p>
      </CardContent>
    </Card>
  )
}
