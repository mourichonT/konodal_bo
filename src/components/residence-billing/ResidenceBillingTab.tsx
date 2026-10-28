import { useCallback, useEffect, useRef, useState } from "react"
import { getCsBillingAdmin, subscribeToCsAvance, type CsBillingAdmin } from "@/lib/csAvance"
import type { Residence } from "@/types/residence"
import { DiscountCard } from "./DiscountCard"
import { HistoryCard } from "./HistoryCard"
import { InvoicesCard } from "./InvoicesCard"
import { OfferCard } from "./OfferCard"
import { SdcCard } from "./SdcCard"
import { SubscriptionCard } from "./SubscriptionCard"

// Onglet « Facturation » de la fiche résidence (superAdmin seulement,
// décision du 28/10/2026) : option CS avancé de la résidence, lue chez Stripe
// à chaque ouverture (get_cs_billing_admin) et rechargée quand
// billing/current change (webhook Stripe, action d'un autre admin).
export function ResidenceBillingTab({ residenceId, residence }: { residenceId: string; residence: Residence }) {
  const [data, setData] = useState<CsBillingAdmin | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reload = useCallback(async () => {
    try {
      setData(await getCsBillingAdmin(residenceId))
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [residenceId])

  useEffect(() => {
    // Les deux écoutes (résidence, billing/current) émettent ensemble au
    // départ puis à chaque écriture : un seul rechargement par rafale.
    const unsubscribe = subscribeToCsAvance(residenceId, () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void reload(), 400)
    })
    return () => {
      unsubscribe()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [residenceId, reload])

  if (error && !data) {
    return <p className="text-sm text-destructive">Facturation indisponible : {error}</p>
  }
  if (!data) return <p className="text-sm text-muted-foreground">Chargement de la facturation…</p>

  // key : les formulaires repartent des valeurs à jour après chaque action.
  const version = JSON.stringify([data.grant?.until, data.subscription?.trialEnd, data.subscription?.status])
  return (
    <div className="flex flex-col gap-5">
      <SubscriptionCard residenceId={residenceId} data={data} onChanged={reload} />
      <div className="grid gap-5 lg:grid-cols-2">
        <DiscountCard residenceId={residenceId} data={data} onChanged={reload} />
        <OfferCard key={version} residenceId={residenceId} data={data} onChanged={reload} />
      </div>
      <InvoicesCard residenceId={residenceId} data={data} onChanged={reload} />
      <SdcCard residenceId={residenceId} residence={residence} data={data} onChanged={reload} />
      <HistoryCard residenceId={residenceId} />
    </div>
  )
}
