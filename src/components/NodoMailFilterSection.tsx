import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Sparkles } from "lucide-react"
import { doc, onSnapshot } from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { db, functions } from "@/firebase"
import { Button } from "@/components/ui/button"
import { useAccountRole } from "@/hooks/useAccountRole"
import { cn, PRIMARY_CTA_CLASS } from "@/lib/utils"

type FilterPayload = { geranceId: string; enabled: boolean }

// « Nodo répond aux copropriétaires » (filtre des mails au syndic,
// functions_python/nodo_mail.py) : option de l'agence, valable pour toutes
// les résidences dont elle est le syndic (gerances/{id}.nodoMailFilter),
// désactivée par défaut. Réglée par le compte agence - pas un agent - ou un
// administrateur Konodal (set_nodo_mail_filter, qui revérifie le rôle ;
// firestore.rules interdit l'écriture directe). Activation fermée tant que
// config/app.nodoMailFilterAvailable est faux (app des stores qui n'affiche
// pas encore les réponses de Nodo) : cachée à l'agence, bouton grisé pour le
// superAdmin ; désactiver reste possible.
export function NodoMailFilterSection({ geranceId }: { geranceId: string }) {
  const { isSuperAdmin, isAgence, geranceId: ownGeranceId } = useAccountRole()
  const [saving, setSaving] = useState(false)
  const [available, setAvailable] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [isSyndic, setIsSyndic] = useState(false)
  const isOwnAgence = isAgence && geranceId === ownGeranceId

  useEffect(
    () =>
      onSnapshot(
        doc(db, "config", "app"),
        (snap) => setAvailable(snap.data()?.nodoMailFilterAvailable === true),
        () => setAvailable(false)
      ),
    []
  )

  useEffect(
    () =>
      onSnapshot(
        doc(db, "gerances", geranceId),
        (snap) => {
          setEnabled(snap.data()?.nodoMailFilter?.enabled === true)
          setIsSyndic(!!snap.data()?.services?.serviceSyndic)
        },
        () => setIsSyndic(false)
      ),
    [geranceId]
  )

  if (!isSyndic) return null
  if (!isSuperAdmin && !(isOwnAgence && (available || enabled))) return null

  async function toggle() {
    setSaving(true)
    try {
      await httpsCallable<FilterPayload, { enabled: boolean }>(functions, "set_nodo_mail_filter")({
        geranceId,
        enabled: !enabled,
      })
      toast.success(enabled ? "Nodo ne répond plus aux résidents" : "Nodo répond aux résidents de vos résidences")
    } catch (err) {
      toast.error("Réglage impossible : " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl bg-[oklch(97%_0.006_155)] p-[14px_18px] text-[12.5px]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-2 font-bold text-[oklch(30%_0.01_150)]">
            <Sparkles className="size-4 text-primary" />
            Nodo répond aux copropriétaires
          </span>
          <span className="max-w-[560px] leading-normal text-muted-foreground">
            Pour toutes les résidences dont l'agence est le syndic. Quand un résident écrit au syndic depuis
            l'application, Nodo lit son message. S'il peut répondre à toute la demande (règle, fonctionnement de la
            copropriété, documents et publications de la résidence), il répond à la place du syndic et le message
            n'est pas envoyé ; le résident peut toujours le transmettre. Une demande (travaux, accord, ordre du jour…)
            ou le moindre doute : le message part au syndic comme aujourd'hui. Les messages traités par Nodo restent
            visibles dans les échanges mails de chaque résident.
          </span>
        </div>
        <Button
          type="button"
          disabled={saving || (!enabled && !available)}
          className={cn("h-9 shrink-0 rounded-[10px] px-4 text-[13px] font-bold", !enabled && PRIMARY_CTA_CLASS)}
          variant={enabled ? "outline" : "default"}
          onClick={toggle}
        >
          {enabled ? "Désactiver" : "Activer"}
        </Button>
      </div>
      <span className={cn("font-bold", enabled ? "text-[oklch(42%_0.08_155)]" : "text-[oklch(52%_0.01_150)]")}>
        {enabled ? "Activé pour toutes les résidences de l'agence" : "Désactivé"}
      </span>
      {!available && (
        <span className="text-muted-foreground">
          Pas encore ouvert : à activer quand la version de l'application qui affiche les réponses de Nodo sera
          publiée{isSuperAdmin && " (config/app.nodoMailFilterAvailable)"}.
        </span>
      )}
    </div>
  )
}
