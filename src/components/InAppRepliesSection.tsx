import { useState } from "react"
import { toast } from "sonner"
import { Reply } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { useAccountRole } from "@/hooks/useAccountRole"
import { useAuth } from "@/lib/auth-context"
import { setInAppReplies } from "@/lib/gerances"
import { cn, ICON_TILE_CLASS, ICON_TILE_OFF_CLASS, ICON_TILE_ON_CLASS, PANEL_CARD_CLASS } from "@/lib/utils"
import type { Gerance } from "@/types/gerance"

// « Réponses dans l'application » (fiche agence) : l'agence et ses agents
// répondent aux résidents depuis la page Messages ; la réponse s'affiche
// dans l'app du résident et une copie arrive dans la boîte mail du syndic.
// Active par défaut. Réglée par le compte agence ou un superAdmin, cachée aux
// agents ; seulement pour une agence qui a le service Syndic.
export function InAppRepliesSection({ gerance }: { gerance: Gerance }) {
  const { isSuperAdmin, isAgence, geranceId: ownGeranceId } = useAccountRole()
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const enabled = gerance.inAppReplies?.enabled !== false
  const canEdit = isSuperAdmin || (isAgence && gerance.id === ownGeranceId)

  if (!gerance.services.serviceSyndic || !canEdit) return null

  async function toggle() {
    if (!user) return
    setSaving(true)
    try {
      await setInAppReplies(gerance.id, !enabled, user.uid)
      toast.success(enabled ? "Réponses depuis Konodal désactivées" : "Réponses depuis Konodal activées")
    } catch (err) {
      toast.error("Réglage impossible : " + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const rowClass = "border-t border-[oklch(94%_0.004_100)] px-[22px] py-3"
  return (
    <div className={cn(PANEL_CARD_CLASS, "overflow-hidden p-0 text-[12.5px]")}>
      <div className="flex items-start gap-3 px-[22px] pt-[18px] pb-3">
        <div className={cn(ICON_TILE_CLASS, enabled ? ICON_TILE_ON_CLASS : ICON_TILE_OFF_CLASS)}>
          <Reply />
        </div>
        <div className="min-w-0 flex-1">
          <span
            id={`in-app-replies-${gerance.id}`}
            className="block text-[15px] leading-snug font-extrabold text-[oklch(22%_0.01_150)]"
          >
            Réponses dans l'application
          </span>
          <span className="text-[12px] text-muted-foreground">Page Messages</span>
        </div>
        <Switch
          checked={enabled}
          disabled={saving}
          onCheckedChange={toggle}
          aria-labelledby={`in-app-replies-${gerance.id}`}
          className="mt-[7px]"
        />
      </div>
      <p className="m-0 px-[22px] pb-3.5 text-[13px] leading-normal text-[oklch(35%_0.01_150)]">
        Votre agence et vos agents répondent aux résidents depuis la page Messages : la réponse s'affiche dans leur
        application et une copie arrive dans votre boîte mail, dans le fil du message.
      </p>
      <div className={rowClass}>
        <span className={enabled ? "font-bold text-[oklch(42%_0.08_155)]" : "text-muted-foreground"}>
          {enabled ? "Activé" : "Désactivé"}
        </span>
      </div>
    </div>
  )
}
