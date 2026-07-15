import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
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

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Konodal Backoffice</CardTitle>
          <CardDescription>Connecte-toi pour accéder à l'administration.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={submitting} className="w-full">
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
            className="w-full"
          >
            Continuer avec Google
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
