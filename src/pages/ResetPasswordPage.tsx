import { useEffect, useState, type FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth"
import { toast } from "sonner"
import { Eye, EyeOff } from "lucide-react"
import { auth } from "@/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import logoVertical from "@/assets/logo_vertical-transparent_green.png"
import { PRIMARY_CTA_CLASS } from "@/lib/utils"

function firebaseAuthErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code
  switch (code) {
    case "auth/expired-action-code":
    case "auth/invalid-action-code":
      return "Ce lien n'est plus valide ou a déjà été utilisé."
    case "auth/weak-password":
      return "Mot de passe trop court (6 caractères minimum)."
    default:
      return "Impossible de réinitialiser le mot de passe, réessaie."
  }
}

// Page custom appelée depuis le lien de l'email "réinitialiser le mot de
// passe" (Console Firebase > Authentication > Templates > Réinitialisation
// du mot de passe > URL d'action personnalisée, doit pointer ici plutôt que
// vers la page /__/auth/action générique de Firebase) - reprend le style de
// LoginPage plutôt que la page blanche par défaut de Firebase.
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const oobCode = searchParams.get("oobCode") ?? ""
  const [status, setStatus] = useState<"verifying" | "valid" | "invalid">("verifying")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!oobCode) {
      setStatus("invalid")
      return
    }
    verifyPasswordResetCode(auth, oobCode)
      .then((verifiedEmail) => {
        setEmail(verifiedEmail)
        setStatus("valid")
      })
      .catch(() => setStatus("invalid"))
  }, [oobCode])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await confirmPasswordReset(auth, oobCode, password)
      toast.success("Mot de passe mis à jour, tu peux te connecter")
      navigate("/login", { replace: true })
    } catch (err) {
      toast.error(firebaseAuthErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="relative flex min-h-svh items-center justify-center overflow-hidden p-4"
      style={{ background: "oklch(97% 0.005 100)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 h-[420px] w-[420px] rounded-full"
        style={{ background: "radial-gradient(circle, oklch(90% 0.05 150 / 0.5), transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -bottom-44 h-[460px] w-[460px] rounded-full"
        style={{ background: "radial-gradient(circle, oklch(88% 0.06 150 / 0.45), transparent 70%)" }}
      />

      <Card className="relative w-full max-w-sm p-9">
        <CardContent className="flex flex-col gap-0 p-0">
          <img src={logoVertical} alt="Konodal" className="mx-auto mb-[30px] h-[140px] w-auto" />

          {status === "invalid" ? (
            <>
              <h1 className="mb-1.5 text-xl font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">
                Lien invalide
              </h1>
              <p className="mb-6 text-[13.5px] text-[oklch(52%_0.01_150)]">
                Ce lien de réinitialisation n'est plus valide ou a déjà été utilisé.
              </p>
              <Link
                to="/login"
                className="text-center text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Retour à la connexion
              </Link>
            </>
          ) : (
            <>
              <h1 className="mb-1.5 text-xl font-extrabold tracking-tight text-[oklch(22%_0.01_150)]">
                Réinitialiser le mot de passe
              </h1>
              <p className="mb-6 text-[13.5px] text-[oklch(52%_0.01_150)]">
                pour{" "}
                <strong className="font-bold text-[oklch(30%_0.01_150)]">
                  {status === "verifying" ? "…" : email}
                </strong>
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-password">Nouveau mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={6}
                      disabled={status !== "valid"}
                      className="h-11 px-3.5 pr-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submitting || status !== "valid"}
                  className={`h-11 w-full px-4 ${PRIMARY_CTA_CLASS}`}
                >
                  Enregistrer
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
