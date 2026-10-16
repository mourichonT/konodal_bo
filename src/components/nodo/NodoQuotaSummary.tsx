import { useEffect, useState } from "react"
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { db } from "@/firebase"
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin"
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
        setDraft(String(value))
      },
      () => undefined
    )
  }, [geranceId])

  async function handleSave() {
    const value = Number(draft.replace(/\s/g, ""))
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Plafond invalide")
      return
    }
    setSaving(true)
    try {
      await updateDoc(doc(db, "gerances", geranceId), { nodoMonthlyTokenLimit: Math.round(value) })
      setLimit(Math.round(value))
      toast.success("Plafond Nodo mis à jour")
    } catch (error) {
      toast.error("Mise à jour impossible : " + (error instanceof Error ? error.message : String(error)))
    } finally {
      setSaving(false)
    }
  }

  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl bg-[oklch(97%_0.006_155)] p-[14px_18px] text-[12.5px]">
      <div className="flex items-center gap-2 font-bold text-[oklch(30%_0.01_150)]">
        <NodoIcon className="size-4" color="oklch(38% 0.07 152)" />
        Nodo, assistant IA : consommation du mois
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[oklch(92%_0.01_150)]">
        <div
          className={percent >= 90 ? "h-full bg-red-500" : "h-full bg-[oklch(45%_0.1_155)]"}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="font-semibold text-muted-foreground">
        <strong className="text-foreground">{formatter.format(used)}</strong> / {formatter.format(limit)} tokens
        pondérés ({percent} %)
      </span>
      {isSuperAdmin && (
        <div className="flex items-center gap-2">
          <Input
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-8 max-w-40 bg-white text-[12.5px]"
            aria-label="Plafond mensuel Nodo (tokens)"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={saving || draft === String(limit)}
            onClick={handleSave}
          >
            Enregistrer le plafond
          </Button>
        </div>
      )}
    </div>
  )
}
