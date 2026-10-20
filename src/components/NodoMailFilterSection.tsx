import { useState } from "react"
import { toast } from "sonner"
import { Sparkles } from "lucide-react"
import { httpsCallable } from "firebase/functions"
import { functions } from "@/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn, PRIMARY_CTA_CLASS } from "@/lib/utils"
import type { Residence } from "@/types/residence"

type FilterPayload = { residenceId?: string; geranceId?: string; enabled: boolean }

// « Nodo répond aux copropriétaires » (filtre des mails au syndic,
// functions_python/nodo_mail.py) : réglé par le syndic de la résidence ou un
// administrateur Konodal (set_nodo_mail_filter), désactivé par défaut. La
// fiche suit le réglage par l'abonnement à la résidence.
export function NodoMailFilterSection({ residenceId, residence }: { residenceId: string; residence: Residence }) {
  const [saving, setSaving] = useState(false)
  const enabled = residence.nodoMailFilter?.enabled === true
  const geranceId = residence.geranceRef?.geranceId

  async function save(payload: FilterPayload, done: (updated: number) => string) {
    setSaving(true)
    try {
      const result = await httpsCallable<FilterPayload, { updated: number }>(functions, "set_nodo_mail_filter")(payload)
      toast.success(done(result.data.updated))
    } catch (err) {
      toast.error("Réglage impossible : " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="[--card-spacing:--spacing(7)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-extrabold text-[oklch(22%_0.01_150)]">
          <Sparkles className="size-4 text-primary" />
          Nodo répond aux copropriétaires
        </CardTitle>
        <CardDescription className="max-w-[560px] leading-normal">
          Quand un résident vous écrit depuis l'application, Nodo lit son message. S'il peut répondre à toute la
          demande (règle, fonctionnement de la copropriété, documents et publications de la résidence), il répond à
          votre place et le message ne vous est pas envoyé ; le résident peut toujours vous le transmettre. Sinon, ou au
          moindre doute, le message vous parvient comme aujourd'hui. Les messages traités par Nodo restent visibles dans
          les échanges mails de chaque résident. Fonctionne avec l'option CS avancé.
        </CardDescription>
        <CardAction>
          <Button
            disabled={saving}
            className={cn("h-10 rounded-[12px] px-[18px] text-[13px] font-bold", !enabled && PRIMARY_CTA_CLASS)}
            variant={enabled ? "outline" : "default"}
            onClick={() =>
              save({ residenceId, enabled: !enabled }, () => (enabled ? "Nodo ne répond plus aux résidents" : "Nodo répond aux résidents"))
            }
          >
            {enabled ? "Désactiver" : "Activer"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3 text-sm">
        <span className={cn("font-bold", enabled ? "text-[oklch(42%_0.08_155)]" : "text-[oklch(52%_0.01_150)]")}>
          {enabled ? "Activé pour cette résidence" : "Désactivé pour cette résidence"}
        </span>
        {geranceId && (
          <Button
            variant="outline"
            disabled={saving}
            className="h-9 rounded-[10px] text-[13px]"
            onClick={() =>
              save({ geranceId, enabled: true }, (updated) =>
                `Activé pour ${updated} résidence${updated > 1 ? "s" : ""} de votre cabinet`
              )
            }
          >
            Activer pour toutes mes résidences
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
