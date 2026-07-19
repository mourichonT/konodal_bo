import { doc, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from "firebase/firestore"
import { db } from "@/firebase"
import type { AdCampaignConfig } from "@/types/adCampaign"

// Singleton config/adCampaigns : fréquence d'affichage partagée par TOUTES
// les campagnes pub (plus de réglage par-campagne) - lu côté app mobile via
// adCampaignConfigProvider (home_view.dart).
const configDoc = doc(db, "config", "adCampaigns")

export function subscribeToAdCampaignConfig(
  onData: (config: AdCampaignConfig) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    configDoc,
    (snapshot) => {
      const data = snapshot.data() ?? {}
      onData({ displayFrequency: (data.displayFrequency as number) ?? 0 })
    },
    onError
  )
}

export async function updateAdCampaignConfig(displayFrequency: number) {
  await setDoc(configDoc, { displayFrequency, updatedAt: serverTimestamp() }, { merge: true })
}
