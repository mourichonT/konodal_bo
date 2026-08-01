import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import { CreditCard, KeyRound, Minus, Plus } from "lucide-react"
import logoGreen from "@/assets/logo_transparent-green.png"
import { useManropeFont } from "@/hooks/useManropeFont"
import { createOfferCheckoutSession, getOffer, requestOfferPasswordLink, type Offer } from "@/lib/offers"
import { CARD_SHADOW, CTA_GRADIENT, CTA_SHADOW } from "@/lib/utils"

function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100)
}

export default function OfferPage() {
  useManropeFont()
  const { token } = useParams<{ token: string }>()
  const [searchParams] = useSearchParams()
  const checkout = searchParams.get("checkout")

  const [offer, setOffer] = useState<Offer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [redirecting, setRedirecting] = useState(false)

  const [passwordLink, setPasswordLink] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setError(null)
    getOffer(token)
      .then((data) => {
        setOffer(data)
        setQuantity(Math.max(1, data.existingSeatCount))
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false))
  }, [token])

  // Paiement confirmé (retour de Stripe Checkout OU lien de l'email rouvert
  // après coup, cf. offer.redeemed) : le lien de définition de mot de passe
  // est généré à la demande à ce moment précis (pas embarqué dans l'email
  // initial, qui aurait pu expirer entre-temps si l'invité a mis du temps à
  // choisir/payer). Le compte réel n'est créé que par le webhook Stripe, qui
  // peut arriver avec un léger retard sur la redirection du navigateur - on
  // réessaie donc tant que le serveur répond "pending", plutôt qu'une erreur.
  const isPaid = checkout === "success" || offer?.redeemed === true
  useEffect(() => {
    if (!isPaid || !token) return
    let cancelled = false
    let attempts = 0
    setConfirming(true)
    setPasswordError(null)

    function poll() {
      requestOfferPasswordLink(token!)
        .then((result) => {
          if (cancelled) return
          if (result.pending) {
            attempts += 1
            if (attempts >= 15) {
              setConfirming(false)
              setPasswordError(
                "La confirmation du paiement prend plus de temps que prévu. Si cela persiste, contactez support@konodal.com."
              )
              return
            }
            setTimeout(poll, 2000)
          } else {
            setConfirming(false)
            setPasswordLink(result.link)
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setConfirming(false)
            setPasswordError((err as Error).message)
          }
        })
    }
    poll()

    return () => {
      cancelled = true
    }
  }, [isPaid, token])

  async function handleCheckout() {
    if (!token) return
    setRedirecting(true)
    try {
      const { url } = await createOfferCheckoutSession(token, quantity)
      window.location.href = url
    } catch (err) {
      setError((err as Error).message)
      setRedirecting(false)
    }
  }

  const total =
    offer?.pricePerSeatCents != null && offer.priceCurrency
      ? formatAmount(offer.pricePerSeatCents * quantity, offer.priceCurrency)
      : "—"
  const unitPrice =
    offer?.pricePerSeatCents != null && offer.priceCurrency
      ? formatAmount(offer.pricePerSeatCents, offer.priceCurrency)
      : "—"

  return (
    <div
      className="flex min-h-svh justify-center px-4 py-14 pb-24 sm:px-6"
      style={{ background: "oklch(97.5% 0.006 95)", fontFamily: "'Manrope', system-ui, sans-serif" }}
    >
      <div className="flex w-full max-w-[720px] flex-col gap-5">
        <div
          className="relative overflow-hidden rounded-[32px] px-6 py-11 sm:px-12 sm:py-14"
          style={{
            background:
              "linear-gradient(150deg, oklch(30% 0.05 155) 0%, oklch(42% 0.075 152) 55%, oklch(48% 0.09 148) 100%)",
            boxShadow: "0 24px 60px -20px oklch(30% 0.05 155 / 0.45)",
          }}
        >
          <div
            className="pointer-events-none absolute -top-16 -right-16 h-[260px] w-[260px] rounded-full"
            style={{ background: "radial-gradient(circle, oklch(70% 0.1 145 / 0.18), transparent 70%)" }}
          />
          <div
            className="pointer-events-none absolute -bottom-24 -left-10 h-[220px] w-[220px] rounded-full"
            style={{ background: "radial-gradient(circle, oklch(80% 0.08 140 / 0.12), transparent 70%)" }}
          />

          <div className="relative flex items-center">
            <div className="inline-flex rounded-xl bg-[oklch(97%_0.01_100/0.95)] px-3.5 py-2">
              <img src={logoGreen} alt="Konodal" className="block h-5 w-auto" />
            </div>
          </div>

          <div className="relative mt-10 sm:mt-11">
            <div className="mb-4 inline-block rounded-full bg-[oklch(96%_0.02_140/0.14)] px-3.5 py-1 text-[12.5px] font-semibold tracking-wide text-[oklch(94%_0.02_140)]">
              Espace partenaires
            </div>
            <h1 className="m-0 text-[32px] leading-[1.05] font-extrabold tracking-tight text-white sm:text-[42px]">
              Nos offres
            </h1>
            <p className="mt-3 max-w-[440px] text-[15px] leading-relaxed text-[oklch(92%_0.015_140)] sm:text-base">
              Une licence, un tarif simple, sans surprise. Ajustez le nombre selon vos besoins.
            </p>
          </div>
        </div>

        {loading && <p className="text-center text-sm text-[oklch(55%_0.01_150)]">Chargement…</p>}
        {error && (
          <div
            className="rounded-[28px] border border-[oklch(93%_0.005_100)] bg-white px-7 py-6 text-sm text-destructive"
            style={{ boxShadow: CARD_SHADOW }}
          >
            {error}
          </div>
        )}

        {offer && isPaid && (
          <div
            className="rounded-[28px] border border-[oklch(93%_0.005_100)] bg-white p-8 sm:p-9"
            style={{ boxShadow: CARD_SHADOW }}
          >
            <h2 className="m-0 mb-1.5 text-xl font-bold tracking-tight text-[oklch(22%_0.01_150)]">
              Paiement confirmé
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[oklch(42%_0.01_150)]">
              Merci, votre abonnement KONODAL pour <strong>{offer.geranceName}</strong> est activé. Il ne vous reste
              plus qu'à définir votre mot de passe pour accéder au backoffice.
            </p>
            {confirming && !passwordLink && (
              <p className="mt-3 text-sm text-[oklch(55%_0.01_150)]">Confirmation du paiement en cours…</p>
            )}
            {passwordError && <p className="mt-3 text-sm text-destructive">{passwordError}</p>}
            <a
              href={passwordLink ?? undefined}
              className={`mt-6 inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-[15.5px] font-bold text-white ${
                passwordLink ? "cursor-pointer" : "pointer-events-none opacity-50"
              }`}
              style={{ background: CTA_GRADIENT, boxShadow: CTA_SHADOW }}
            >
              <KeyRound className="h-4 w-4" />
              Définir mon mot de passe
            </a>
          </div>
        )}

        {offer && !isPaid && (
          <>
            <div
              className="rounded-[28px] border border-[oklch(93%_0.005_100)] bg-white p-8 sm:p-9"
              style={{ boxShadow: CARD_SHADOW }}
            >
              <h2 className="m-0 mb-1.5 text-xl font-bold tracking-tight text-[oklch(22%_0.01_150)]">
                Bienvenue {offer.geranceName}
              </h2>
              <div className="mb-3.5 inline-flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-[oklch(93%_0.03_150)] px-2.5 py-1 text-[12.5px] font-bold text-[oklch(38%_0.08_155)]">
                  {offer.roleLabel}
                </span>
                {offer.serviceLabel && (
                  <span className="rounded-full bg-[oklch(93%_0.03_150)] px-2.5 py-1 text-[12.5px] font-bold text-[oklch(38%_0.08_155)]">
                    {offer.serviceLabel}
                  </span>
                )}
                <span className="text-[13px] text-[oklch(58%_0.01_150)]">— invitation</span>
              </div>
              <p className="m-0 text-[15px] leading-relaxed text-[oklch(42%_0.01_150)]">
                KONODAL simplifie la gestion quotidienne de vos résidences : suivi des sinistres et interventions,
                communication avec les résidents, documents partagés — tout au même endroit.
              </p>
              {checkout === "cancel" && (
                <p className="mt-3 text-sm text-destructive">
                  Paiement annulé, vous pouvez réessayer quand vous le souhaitez.
                </p>
              )}
            </div>

            <div
              className="rounded-[28px] border border-[oklch(93%_0.005_100)] bg-white p-8 sm:p-9"
              style={{ boxShadow: CARD_SHADOW }}
            >
              <h2 className="m-0 mb-6 text-xl font-bold tracking-tight text-[oklch(22%_0.01_150)]">
                Choisir votre offre
              </h2>

              <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                  <div className="mb-1 text-[13px] font-semibold text-[oklch(55%_0.01_150)]">
                    Prix / licence <span className="text-[oklch(48%_0.09_155)]">HT</span>
                  </div>
                  <div className="text-[22px] font-extrabold text-[oklch(22%_0.01_150)]">
                    {unitPrice} <span className="text-sm font-semibold text-[oklch(55%_0.01_150)]">/ mois</span>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-2">
                  <div className="text-[13px] font-semibold text-[oklch(55%_0.01_150)]">Nombre de licences</div>
                  <div className="flex items-center overflow-hidden rounded-2xl border border-[oklch(90%_0.005_100)]">
                    <button
                      type="button"
                      aria-label="Retirer une licence"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="flex h-10 w-10 items-center justify-center bg-[oklch(97%_0.005_100)] text-[oklch(30%_0.01_150)] hover:bg-[oklch(93%_0.005_100)]"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <div className="w-[52px] text-center text-base font-bold text-[oklch(22%_0.01_150)]">
                      {quantity}
                    </div>
                    <button
                      type="button"
                      aria-label="Ajouter une licence"
                      onClick={() => setQuantity((q) => Math.min(50, q + 1))}
                      className="flex h-10 w-10 items-center justify-center bg-[oklch(97%_0.005_100)] text-[oklch(30%_0.01_150)] hover:bg-[oklch(93%_0.005_100)]"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <div className="mb-1 text-[13px] font-semibold text-[oklch(55%_0.01_150)]">
                    Total <span className="text-[oklch(48%_0.09_155)]">HT</span>
                  </div>
                  <div className="text-2xl font-extrabold text-[oklch(38%_0.08_155)]">
                    {total} <span className="text-sm font-semibold text-[oklch(55%_0.01_150)]">/ mois</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={redirecting}
                onClick={handleCheckout}
                className="mt-7 flex w-full items-center justify-center gap-2.5 rounded-2xl px-4 py-4 text-[15.5px] font-bold text-white disabled:opacity-60"
                style={{ background: CTA_GRADIENT, boxShadow: CTA_SHADOW }}
              >
                <CreditCard className="h-4 w-4" />
                Passer au paiement
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
