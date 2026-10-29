import { useState, type FormEvent } from "react"
import { toast } from "sonner"
import { loadStripe, type Stripe } from "@stripe/stripe-js"
import {
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
  Elements,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js"
import { AlertTriangle, Clock, ExternalLink, Lock, Plus, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  FIELD_CLASS,
  formatLongDate,
  OUTLINE_BUTTON_CLASS,
  Pill,
  ROW_BORDER_CLASS,
  TITLE_CLASS,
} from "@/components/agency/agencyUi"
import { createBillingPortalSession, createCardSetup, deleteCard, retryPayment, saveCard } from "@/lib/billing"
import { formatCents } from "@/lib/licences"
import { cn, PANEL_CARD_CLASS, PRIMARY_CTA_CLASS } from "@/lib/utils"
import type { BillingPaymentIssue, BillingPaymentMethod, BillingStatus } from "@/types/billing"

// Clé publique Stripe (pk_test_… en dev, pk_live_… en prod, .env du BO).
// Sans elle, « Ajouter une carte » passe par le portail Stripe.
const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined
let stripePromise: Promise<Stripe | null> | null = null
function getStripe() {
  if (!stripePromise && PUBLISHABLE_KEY) stripePromise = loadStripe(PUBLISHABLE_KEY)
  return stripePromise
}

const ELEMENT_OPTIONS = {
  style: {
    base: {
      fontFamily: "Roboto, ui-sans-serif, system-ui, sans-serif",
      fontSize: "14px",
      color: "#1f2a24",
      "::placeholder": { color: "#8a948e" },
    },
    invalid: { color: "#c0392b" },
  },
}
const ELEMENT_BOX_CLASS =
  "flex h-10 items-center rounded-[10px] border border-input bg-white px-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"

// Raisons de refus des banques (decline_code Stripe), en clair.
const DECLINE_REASONS: Record<string, string> = {
  insufficient_funds: "fonds insuffisants",
  expired_card: "carte expirée",
  card_declined: "carte refusée par la banque",
  generic_decline: "carte refusée par la banque",
  do_not_honor: "carte refusée par la banque",
  incorrect_cvc: "code de sécurité incorrect",
  incorrect_number: "numéro de carte incorrect",
  lost_card: "carte déclarée perdue",
  stolen_card: "carte déclarée volée",
  pickup_card: "carte bloquée par la banque",
  restricted_card: "carte bloquée par la banque",
  fraudulent: "paiement bloqué par la banque",
  card_velocity_exceeded: "plafond de la carte atteint",
  withdrawal_count_limit_exceeded: "plafond de la carte atteint",
  authentication_required: "authentification bancaire requise",
  processing_error: "erreur de traitement de la banque",
}

type Tone = "red" | "amber" | "grey"
type CardState = {
  tone: Tone
  title: string
  text: string
  // Bouton du bandeau : nouvelle tentative, ou authentification sur la page
  // de facture Stripe. Ajouter / remplacer la carte restent sous le bandeau.
  action?: "retry" | "authenticate"
  // Pastille de la carte à la place de « Par défaut ».
  pill?: { label: string; tone: "red" | "amber" }
  // Le prochain prélèvement n'est pas annoncé tant que le paiement bloque.
  blocking?: boolean
}

const BANNER_TONES: Record<Tone, string> = {
  red: "border-[oklch(88%_0.06_25)] bg-[oklch(97.5%_0.015_25)] text-[oklch(42%_0.15_27)]",
  amber: "border-[oklch(88%_0.08_85)] bg-[oklch(97.5%_0.035_85)] text-[oklch(40%_0.1_65)]",
  grey: "border-[oklch(91%_0.005_100)] bg-[oklch(97.5%_0.004_100)] text-[oklch(38%_0.01_150)]",
}

function expiryLabel(card: BillingPaymentMethod) {
  return `${String(card.expMonth).padStart(2, "0")}/${card.expYear}`
}

// État à afficher selon l'abonnement (statut Stripe), la dernière facture et
// la carte, du plus urgent au simple avertissement ; null si tout va bien.
function cardState({
  status,
  card,
  issue,
  trialEnd,
  nextDate,
}: {
  status: BillingStatus
  card: BillingPaymentMethod | null
  issue: BillingPaymentIssue | null
  trialEnd: Date | null
  nextDate: Date | null
}): CardState | null {
  if (status === "canceled" || status === "none") return null
  const now = new Date()
  // Une carte est valable jusqu'au dernier jour de son mois d'expiration.
  const validUntil = card?.expYear && card.expMonth ? new Date(card.expYear, card.expMonth, 0, 23, 59) : null
  const expired = !!validUntil && validUntil < now
  const expiresBefore = !!validUntil && !expired && !!nextDate && validUntil < nextDate

  if (issue) {
    const amount = formatCents(issue.amountDueCents)
    if (issue.intentStatus === "requires_action") {
      return {
        tone: "amber",
        title: "Authentification bancaire requise",
        text: `Votre banque demande de confirmer le paiement de ${amount}.`,
        action: "authenticate",
        pill: { label: "À confirmer", tone: "amber" },
        blocking: true,
      }
    }
    if (issue.intentStatus === "processing") {
      return {
        tone: "grey",
        title: "Paiement en cours",
        text: `Le prélèvement de ${amount} est en cours de traitement par votre banque.`,
        blocking: true,
      }
    }
    const reason = (issue.declineCode && DECLINE_REASONS[issue.declineCode]) || null
    return {
      tone: "red",
      title: "Échec du prélèvement",
      text:
        `${amount} n'a pas pu être prélevé${reason ? ` (${reason})` : ""}. ` +
        (issue.nextAttempt
          ? `Nouvelle tentative automatique le ${formatLongDate(issue.nextAttempt)}.`
          : "Plus de nouvelle tentative automatique.") +
        " Une nouvelle carte règle aussi cette facture.",
      action: card ? "retry" : undefined,
      pill: { label: "Refusée", tone: "red" },
      blocking: true,
    }
  }
  if (status === "unpaid") {
    return {
      tone: "red",
      title: "Abonnement impayé",
      text: "Des factures restent impayées : réglez-les pour rétablir l'abonnement.",
      action: card ? "retry" : undefined,
      blocking: true,
    }
  }
  if (status === "past_due") {
    return {
      tone: "red",
      title: "Paiement en retard",
      text: "Le dernier prélèvement n'a pas abouti.",
      action: card ? "retry" : undefined,
      blocking: true,
    }
  }
  if (status === "paused") {
    return {
      tone: "amber",
      title: "Abonnement suspendu",
      text: card
        ? "Le prélèvement n'a pas pu reprendre : remplacez la carte pour réactiver l'abonnement."
        : "La période d'essai est terminée sans carte : ajoutez-en une pour réactiver l'abonnement.",
      blocking: true,
    }
  }
  if (status === "incomplete" || status === "incomplete_expired") {
    return {
      tone: "red",
      title: status === "incomplete" ? "Premier paiement en attente" : "Premier paiement expiré",
      text: "Le paiement de la souscription n'a pas abouti.",
      blocking: true,
    }
  }
  if (card && expired) {
    return {
      tone: "red",
      title: "Carte expirée",
      text: `Cette carte a expiré fin ${expiryLabel(card)}${nextDate ? ` : le prélèvement du ${formatLongDate(nextDate)} échouera.` : "."}`,
      pill: { label: "Expirée", tone: "red" },
      blocking: true,
    }
  }
  if (card && expiresBefore && nextDate) {
    return {
      tone: "amber",
      title: "Carte bientôt expirée",
      text: `Elle expire fin ${expiryLabel(card)}, avant le prochain prélèvement du ${formatLongDate(nextDate)}.`,
      pill: { label: "Expire bientôt", tone: "amber" },
    }
  }
  if (!card && status === "trialing") {
    return {
      tone: "amber",
      title: "Aucune carte enregistrée",
      text: trialEnd
        ? `Ajoutez une carte avant le ${formatLongDate(trialEnd)} : sans carte, l'abonnement est suspendu à la fin de l'essai.`
        : "Ajoutez une carte avant la fin de l'essai : sans carte, l'abonnement est suspendu.",
    }
  }
  if (!card) {
    return {
      tone: "red",
      title: "Aucune carte enregistrée",
      text: nextDate
        ? `Le prélèvement du ${formatLongDate(nextDate)} échouera sans carte.`
        : "Les prochains prélèvements échoueront sans carte.",
    }
  }
  return null
}

// « Moyen de paiement » de l'onglet Abonnement (maquettes 11c, 11f, 11g,
// 11k) : carte saisie dans les champs sécurisés de Stripe (Stripe Elements),
// jamais par Konodal ; une seule carte, utilisée pour l'abonnement. Un
// bandeau signale chaque situation renvoyée par Stripe : prélèvement refusé
// (avec la raison), authentification demandée, paiement en cours, abonnement
// impayé ou suspendu, carte expirée ou qui expire avant le prochain
// prélèvement, aucune carte.
export function PaymentMethodCard({
  geranceId,
  agencyName,
  billingStatus,
  paymentMethod,
  paymentIssue,
  trialEnd,
  loading,
  nextCharge,
  onChanged,
}: {
  geranceId: string
  agencyName: string
  billingStatus: BillingStatus
  paymentMethod: BillingPaymentMethod | null
  paymentIssue: BillingPaymentIssue | null
  trialEnd: Date | null
  loading: boolean
  // Montant et date du prochain prélèvement, si connus.
  nextCharge: { cents: number; date: Date } | null
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const state = cardState({
    status: billingStatus,
    card: paymentMethod,
    issue: paymentIssue,
    trialEnd,
    nextDate: nextCharge?.date ?? null,
  })

  async function openPortal() {
    setBusy(true)
    try {
      const { url } = await createBillingPortalSession(geranceId)
      window.location.href = url
    } catch (err) {
      toast.error("Ouverture impossible : " + (err as Error).message)
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!confirm("Supprimer cette carte ? Sans carte, les prochaines factures ne pourront pas être réglées.")) return
    setBusy(true)
    try {
      await deleteCard(geranceId)
      toast.success("Carte supprimée")
      onChanged()
    } catch (err) {
      toast.error("Suppression impossible : " + (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleRetry() {
    setBusy(true)
    try {
      const result = await retryPayment(geranceId)
      if (result.paid) {
        toast.success("Paiement effectué")
      } else if (result.requiresAction && result.hostedInvoiceUrl) {
        toast.info("Votre banque demande une confirmation")
        window.open(result.hostedInvoiceUrl, "_blank", "noopener")
      } else {
        toast.error("Paiement refusé" + (result.message ? ` : ${result.message}` : ""))
      }
      onChanged()
    } catch (err) {
      toast.error("Nouvelle tentative impossible : " + (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const startEditing = () => (PUBLISHABLE_KEY ? setEditing(true) : openPortal())

  return (
    <section className={cn(PANEL_CARD_CLASS, "overflow-hidden p-0")}>
      <h2 className={cn(TITLE_CLASS, "px-[22px] pt-[18px] pb-3.5 font-sans")}>Moyen de paiement</h2>
      <div className={cn(ROW_BORDER_CLASS, "flex flex-col gap-3 px-[22px] py-4")}>
        {!loading && !editing && state && (
          <div
            className={cn("flex flex-col gap-2.5 rounded-[14px] border p-3 text-[12.5px]", BANNER_TONES[state.tone])}
          >
            <div className="flex items-start gap-2">
              {state.tone === "grey" ? (
                <Clock className="mt-px size-4 shrink-0" />
              ) : (
                <AlertTriangle className="mt-px size-4 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="font-extrabold">{state.title}</div>
                <p className="m-0 leading-snug">{state.text}</p>
              </div>
            </div>
            {state.action === "retry" && (
              <Button
                type="button"
                className={cn(PRIMARY_CTA_CLASS, "h-9 rounded-[11px] font-bold")}
                disabled={busy}
                onClick={handleRetry}
              >
                <RotateCcw />
                Réessayer le paiement
              </Button>
            )}
            {state.action === "authenticate" && paymentIssue?.hostedInvoiceUrl && (
              <Button
                className={cn(PRIMARY_CTA_CLASS, "h-9 rounded-[11px] font-bold")}
                render={<a href={paymentIssue.hostedInvoiceUrl} target="_blank" rel="noreferrer" />}
              >
                <ExternalLink />
                Confirmer le paiement
              </Button>
            )}
          </div>
        )}
        {loading ? (
          <p className="m-0 text-[13px] text-muted-foreground">Chargement…</p>
        ) : editing ? (
          <Elements
            stripe={getStripe()}
            options={{
              locale: "fr",
              // Les champs Stripe sont dans des iframes : police du BO passée ici.
              fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap" }],
            }}
          >
            <CardForm
              geranceId={geranceId}
              defaultName={paymentMethod?.name || agencyName}
              onCancel={() => setEditing(false)}
              onSaved={() => {
                setEditing(false)
                onChanged()
              }}
            />
          </Elements>
        ) : paymentMethod ? (
          <>
            <div
              className={cn(
                "flex items-center gap-3 rounded-[14px] border p-3",
                state?.pill?.tone === "red"
                  ? "border-[oklch(88%_0.06_25)] bg-[oklch(98%_0.01_25)]"
                  : state?.pill?.tone === "amber"
                    ? "border-[oklch(88%_0.08_85)] bg-[oklch(98%_0.025_85)]"
                    : "border-[oklch(85%_0.06_160)] bg-[oklch(96.5%_0.03_160)]"
              )}
            >
              <span className="flex h-8 w-12 shrink-0 items-center justify-center rounded-[7px] bg-[oklch(30%_0.06_155)] text-[10.5px] font-extrabold tracking-wide text-white uppercase">
                {paymentMethod.brand ?? "Carte"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold text-[oklch(22%_0.01_150)]">•••• {paymentMethod.last4}</div>
                <div className="text-[12px] break-words text-muted-foreground">
                  {paymentMethod.expMonth && paymentMethod.expYear
                    ? `Expire ${String(paymentMethod.expMonth).padStart(2, "0")} / ${String(paymentMethod.expYear).slice(-2)}`
                    : "Carte enregistrée"}
                  {paymentMethod.name && ` · ${paymentMethod.name}`}
                </div>
              </div>
              <Pill tone={state?.pill?.tone ?? "green"}>{state?.pill?.label ?? "Par défaut"}</Pill>
            </div>
            {nextCharge && !state?.blocking && (
              <p className="m-0 text-[12.5px] text-muted-foreground">
                Prochain prélèvement : {formatCents(nextCharge.cents)} HT, le {formatLongDate(nextCharge.date)}.
              </p>
            )}
            <div className="flex gap-2.5">
              <Button
                type="button"
                variant="outline"
                className={cn(OUTLINE_BUTTON_CLASS, "flex-1")}
                disabled={busy}
                onClick={startEditing}
              >
                Remplacer la carte
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-9 flex-1 rounded-[11px] text-[13px] font-bold text-[oklch(48%_0.17_27)] hover:bg-[oklch(97%_0.02_25)] hover:text-[oklch(42%_0.17_27)]"
                disabled={busy}
                onClick={handleDelete}
              >
                Supprimer
              </Button>
            </div>
          </>
        ) : (
          <>
            {!state && <p className="m-0 text-[13px] text-muted-foreground">Aucun moyen de paiement enregistré.</p>}
            <Button
              type="button"
              className={cn(PRIMARY_CTA_CLASS, "h-10 w-full rounded-[12px] font-bold")}
              disabled={busy}
              onClick={startEditing}
            >
              <Plus />
              Ajouter une carte
            </Button>
          </>
        )}
      </div>
    </section>
  )
}

function CardForm({
  geranceId,
  defaultName,
  onCancel,
  onSaved,
}: {
  geranceId: string
  defaultName: string
  onCancel: () => void
  onSaved: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [name, setName] = useState(defaultName)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const card = elements?.getElement(CardNumberElement)
    if (!stripe || !card) return
    setSaving(true)
    try {
      const clientSecret = await createCardSetup(geranceId)
      // Authentification forte (3-D Secure) affichée par Stripe si la banque
      // la demande.
      const { setupIntent, error } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card, billing_details: { name: name.trim() || undefined } },
      })
      if (error || !setupIntent) {
        toast.error(error?.message ?? "Carte refusée")
        return
      }
      await saveCard(geranceId, setupIntent.id)
      toast.success("Carte enregistrée")
      onSaved()
    } catch (err) {
      toast.error("Enregistrement impossible : " + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label>Numéro de carte</Label>
        <div className={ELEMENT_BOX_CLASS}>
          <CardNumberElement options={{ ...ELEMENT_OPTIONS, showIcon: true }} className="w-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Expiration</Label>
          <div className={ELEMENT_BOX_CLASS}>
            <CardExpiryElement options={ELEMENT_OPTIONS} className="w-full" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Code de sécurité</Label>
          <div className={ELEMENT_BOX_CLASS}>
            <CardCvcElement options={ELEMENT_OPTIONS} className="w-full" />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="card-name">Nom sur la carte</Label>
        <Input id="card-name" value={name} onChange={(e) => setName(e.target.value)} className={FIELD_CLASS} />
      </div>
      <div className="flex gap-2.5">
        <Button type="button" variant="outline" className="h-10 flex-1 rounded-[12px] font-bold" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          type="submit"
          disabled={!stripe || saving}
          className={cn(PRIMARY_CTA_CLASS, "h-10 flex-[1.4] rounded-[12px] font-bold")}
        >
          {saving ? "Enregistrement…" : "Enregistrer la carte"}
        </Button>
      </div>
      <p className="m-0 flex gap-1.5 text-[11.5px] leading-snug text-muted-foreground">
        <Lock className="mt-px size-3.5 shrink-0" />
        Le paiement est traité par Stripe, prestataire sécurisé. Konodal ne conserve pas votre numéro de carte.
      </p>
    </form>
  )
}
