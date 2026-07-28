import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { sendPasswordResetEmail } from "firebase/auth"
import { toast } from "sonner"
import { auth } from "@/firebase"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import logoVertical from "@/assets/logo_vertical-transparent_green.png"
import googleLogo from "@/assets/google-logo.png"
import { PRIMARY_CTA_CLASS } from "@/lib/utils"

function firebaseAuthErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email ou mot de passe incorrect."
    case "auth/too-many-requests":
      return "Trop de tentatives, réessaie plus tard."
    default:
      return "Connexion impossible, réessaie."
  }
}

export default function LoginPage() {
  const { signInWithEmail, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)

  async function handleEmailSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signInWithEmail(email, password)
      navigate("/", { replace: true })
    } catch (err) {
      setError(firebaseAuthErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGoogleSignIn() {
    setError(null)
    setSubmitting(true)
    try {
      await signInWithGoogle()
      navigate("/", { replace: true })
    } catch (err) {
      setError(firebaseAuthErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      toast.error("Renseigne d'abord ton email ci-dessus")
      return
    }
    setSendingReset(true)
    try {
      await sendPasswordResetEmail(auth, email.trim())
      toast.success("Email de réinitialisation envoyé")
    } catch {
      // Même message quel que soit le code d'erreur (y compris
      // auth/user-not-found) : ne pas confirmer/infirmer l'existence d'un
      // compte à cette adresse à quelqu'un qui n'est pas encore authentifié.
      toast.success("Si un compte existe pour cet email, un lien de réinitialisation a été envoyé")
    } finally {
      setSendingReset(false)
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

      <Card className="relative w-full max-w-sm">
        <CardHeader className="items-center gap-4 p-[30px] pb-0">
          <div className="inline-flex items-center justify-center rounded-[22px] bg-[oklch(97%_0.008_155)] px-6 py-4">
            <img src={logoVertical} alt="Konodal" className="h-[72px] w-auto" />
          </div>
          <div className="flex flex-col gap-1.5 text-center">
            <CardTitle className="text-xl">Back Office</CardTitle>
            <CardDescription>Connecte-toi pour accéder à l'administration.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-[30px]">
          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="h-11 px-3.5"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Mot de passe</Label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={sendingReset}
                  className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                className="h-11 px-3.5"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={submitting} className={`h-11 w-full px-4 ${PRIMARY_CTA_CLASS}`}>
              Se connecter
            </Button>
          </form>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            ou
            <div className="h-px flex-1 bg-border" />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={handleGoogleSignIn}
            className="h-11 w-full px-4"
          >
            <img src={googleLogo} alt="" className="size-4" />
            Continuer avec Google
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Pas encore de compte ?{" "}
            <Link to="/register" className="font-medium text-primary underline-offset-4 hover:underline">
              S'inscrire
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
