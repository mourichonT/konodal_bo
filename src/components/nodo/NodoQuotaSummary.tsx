import { useEffect, useState } from "react"
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { db } from "@/firebase"
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin"
import { cn, ICON_TILE_CLASS, ICON_TILE_ON_CLASS, PANEL_CARD_CLASS } from "@/lib/utils"
import { NodoIcon } from "./NodoIcon"

// Même valeur que NODO_DEFAULT_MONTHLY_TOKENS (functions_python/nodo.py).
const NODO_DEFAULT_MONTHLY_TOKENS = 3_000_000

function currentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

const formatter = new Intl.NumberFormat("fr-FR")

// Consommation de Nodo du mois (gerances/{id}/nodoUsage/{YYYY-MM}, écrit par
// nodo_send_message) et plafond mensuel de l'agence - modifiable par le
// superAdmin seulement (firestore.rules exclut nodoMonthlyTokenLimit des
// champs qu'une agence peut éditer sur sa fiche).
export function NodoQuotaSummary({ geranceId }: { geranceId: string }) {
  const { isSuperAdmin } = useIsSuperAdmin()
  const [used, setUsed] = useState(0)
  const [limit, setLimit] = useState(NODO_DEFAULT_MONTHLY_TOKENS)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    return onSnapshot(
      doc(db, "gerances", geranceId, "nodoUsage", currentMonthKey()),
      (snap) => setUsed((snap.data()?.weightedTokens as number | undefined) ?? 0),
      () => setUsed(0)
    )
  }, [geranceId])

  useEffect(() => {
    getDoc(doc(db, "gerances", geranceId)).then(
      (snap) => {
        const value = (snap.data()?.nodoMonthlyTokenLimit as number | undefined) ?? NODO_DEFAULT_MONTHLY_TOKENS
        setLimit(value)
        setDraft(formatter.format(value))
      },
      () => undefined
    )
  }, [geranceId])

  const draftValue = Number(draft.replace(/\s/g, ""))

  async function handleSave() {
    if (!Number.isFinite(draftValue) || draftValue < 0) {
      toast.error("Plafond invalide")
      return
    }
    setSaving(true)
    try {
      await updateDoc(doc(db, "gerances", geranceId), { nodoMonthlyTokenLimit: Math.round(draftValue) })
      setLimit(Math.round(draftValue))
      setDraft(formatter.format(Math.round(draftValue)))
      toast.success("Plafond Nodo mis à jour")
    } catch (error) {
      toast.error("Mise à jour impossible : " + (error instanceof Error ? error.message : String(error)))
    } finally {
      setSaving(false)
    }
  }

  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100

  return (
    <div className={cn(PANEL_CARD_CLASS, "flex flex-col gap-3 text-[12.5px]")}>
      <div className="flex items-center gap-3">
        <div className={cn(ICON_TILE_CLASS, ICON_TILE_ON_CLASS)}>
          <NodoIcon className="size-[18px]" color="oklch(32% 0.09 155)" />
        </div>
        <span className="text-[14px] font-bold text-[oklch(22%_0.01_150)]">Consommation Nodo</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <strong className="text-[13px] text-foreground">{formatter.format(used)} tokens</strong>
          <span className="text-muted-foreground">
            plafond {formatter.format(limit)} · {percent} %
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[oklch(93%_0.006_150)]">
          <div
            className={percent >= 90 ? "h-full bg-red-500" : "h-full bg-[oklch(45%_0.1_155)]"}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      {isSuperAdmin && (
        <div className="flex items-center gap-2">
          <Input
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSave())}
            className="h-9 min-w-0 flex-1 rounded-[10px] bg-white text-[13px]"
            aria-label="Plafond mensuel Nodo (tokens)"
          />
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-[10px] px-3.5 text-[13px] font-bold"
            disabled={saving || draftValue === limit}
            onClick={handleSave}
          >
            Enregistrer
          </Button>
        </div>
      )}
    </div>
  )
}
