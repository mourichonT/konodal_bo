import { useEffect, useState } from "react"
import { toast } from "sonner"
import { doc, onSnapshot } from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { db, functions } from "@/firebase"
import { NodoIcon } from "@/components/nodo/NodoIcon"
import { Switch } from "@/components/ui/switch"
import { useAccountRole } from "@/hooks/useAccountRole"
import { cn, ICON_TILE_CLASS, ICON_TILE_ON_CLASS, PANEL_CARD_CLASS } from "@/lib/utils"

type FilterPayload = { geranceId: string; enabled?: boolean; copyAnswers?: boolean }

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
  // Copie par mail à l'agence des réponses de Nodo aux résidents.
  const [copyAnswers, setCopyAnswers] = useState(false)
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
          setCopyAnswers(snap.data()?.nodoMailFilter?.copyAnswers === true)
          setIsSyndic(!!snap.data()?.services?.serviceSyndic)
        },
        () => setIsSyndic(false)
      ),
    [geranceId]
  )

  if (!isSyndic) return null
  if (!isSuperAdmin && !(isOwnAgence && (available || enabled))) return null

  async function save(change: Omit<FilterPayload, "geranceId">, success: string) {
    setSaving(true)
    try {
      await httpsCallable<FilterPayload, { enabled: boolean; copyAnswers: boolean }>(
        functions,
        "set_nodo_mail_filter"
      )({ geranceId, ...change })
      toast.success(success)
    } catch (err) {
      toast.error("Réglage impossible : " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSaving(false)
    }
  }

  const toggle = () =>
    save(
      { enabled: !enabled },
      enabled ? "Nodo ne répond plus aux résidents" : "Nodo répond aux résidents de vos résidences"
    )
  const toggleCopy = () =>
    save(
      { copyAnswers: !copyAnswers },
      copyAnswers ? "Vous ne recevrez plus les réponses de Nodo" : "Vous recevrez par mail les réponses de Nodo"
    )

  const rowClass = "border-t border-[oklch(94%_0.004_100)] px-[22px] py-3"

  // Maquette « Agence Gestion Compte Konodal » : Nodo, ce qu'il traite seul,
  // ce qu'il transmet, état et action.
  return (
    <div className={cn(PANEL_CARD_CLASS, "overflow-hidden p-0 text-[12.5px]")}>
      <div className="flex items-start gap-3 px-[22px] pt-[18px] pb-3">
        <div className={cn(ICON_TILE_CLASS, ICON_TILE_ON_CLASS)}>
          <NodoIcon className="size-[18px]" color="oklch(32% 0.09 155)" />
        </div>
        <div className="min-w-0 flex-1">
          <span
            id={`nodo-mail-filter-${geranceId}`}
            className="block text-[15px] leading-snug font-extrabold text-[oklch(22%_0.01_150)]"
          >
            Nodo
          </span>
          <span className="text-[12px] text-muted-foreground">Assistant IA</span>
        </div>
        <Switch
          checked={enabled}
          disabled={saving || (!enabled && !available)}
          onCheckedChange={toggle}
          aria-labelledby={`nodo-mail-filter-${geranceId}`}
          className="mt-[7px]"
        />
      </div>
      <p className="m-0 px-[22px] pb-3.5 text-[13px] leading-normal text-[oklch(35%_0.01_150)]">
        Répond à vos copropriétaires à votre place quand ils écrivent au syndic depuis l'application, et vous transmet
        ce qui demande votre avis.
      </p>
      <div className={rowClass}>
        <div className="font-bold text-[oklch(22%_0.01_150)]">Répond seul</div>
        <div className="text-muted-foreground">Règlement, documents, publications.</div>
      </div>
      <div className={rowClass}>
        <div className="font-bold text-[oklch(22%_0.01_150)]">Vous transmet</div>
        <div className="text-muted-foreground">Travaux, accords, ordre du jour, tout message urgent, doute.</div>
      </div>
      {/* Copie par mail des réponses de Nodo (sans effet tant qu'il ne répond pas). */}
      <div className={cn(rowClass, "flex items-start gap-3")}>
        <div className="min-w-0 flex-1">
          <div id={`nodo-copy-answers-${geranceId}`} className="font-bold text-[oklch(22%_0.01_150)]">
            Recevoir ses réponses par mail
          </div>
          <div className="text-muted-foreground">
            Une copie de chaque réponse de Nodo à un résident, dans votre boîte mail, avec son message.
          </div>
        </div>
        <Switch
          checked={copyAnswers}
          disabled={saving || !enabled}
          onCheckedChange={toggleCopy}
          aria-labelledby={`nodo-copy-answers-${geranceId}`}
          className="mt-0.5"
        />
      </div>
      {!available && (
        <p className="m-0 px-[22px] pb-3 text-muted-foreground">
          À activer quand la version de l'application qui affiche les réponses de Nodo sera publiée
          {isSuperAdmin && " (config/app.nodoMailFilterAvailable)"}. Les messages traités restent visibles dans les
          échanges.
        </p>
      )}
    </div>
  )
}
