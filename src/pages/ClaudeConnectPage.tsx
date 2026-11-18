import { useEffect, useState } from "react"
import { Link, useLocation, useSearchParams } from "react-router-dom"
import { httpsCallable } from "firebase/functions"
import { Check, LoaderCircle, ShieldCheck, X } from "lucide-react"
import { functions } from "@/firebase"
import { useAuth } from "@/lib/auth-context"
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PRIMARY_CTA_CLASS } from "@/lib/utils"
import logoVertical from "@/assets/logo_vertical-transparent_green.png"

type ConsentAction = "describe" | "approve" | "deny"
type ConsentResult = { clientName?: string; redirectUrl?: string }

const consentCall = httpsCallable<{ requestId: string; action: ConsentAction }, ConsentResult>(
  functions,
  "residence_import_oauth_consent"
)

// Connexion du connecteur Konodal dans Claude (konodal_app/functions_python/
// residence_import_oauth.py) : Claude envoie ici le superAdmin, qui autorise
// ou refuse ; la fonction renvoie l'adresse de retour vers Claude. Hors de
// ProtectedRoute : la connexion se fait par /login?next=… pour revenir ici.
export default function ClaudeConnectPage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const requestId = searchParams.get("demande") ?? ""
  const { user, loading: authLoading } = useAuth()
  const { isSuperAdmin, loading: roleLoading } = useIsSuperAdmin()
  const [clientName, setClientName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<ConsentAction | null>(null)

  const ready = !authLoading && !!user && !roleLoading && isSuperAdmin

  useEffect(() => {
    if (!ready || !requestId) return
    consentCall({ requestId, action: "describe" })
      .then((r) => setClientName(r.data.clientName ?? "Claude"))
      .catch((err: Error) => setError(err.message))
  }, [ready, requestId])

  async function answer(action: "approve" | "deny") {
    setBusy(action)
    try {
      const { data } = await consentCall({ requestId, action })
      if (data.redirectUrl) window.location.assign(data.redirectUrl)
    } catch (err) {
      setError((err as Error).message)
      setBusy(null)
    }
  }

  let content
  if (!requestId) {
    content = <p className="text-sm text-muted-foreground">Lien incomplet : relancez la connexion depuis Claude.</p>
  } else if (authLoading || (user && roleLoading)) {
    content = <p className="text-sm text-muted-foreground">Chargement…</p>
  } else if (!user) {
    content = (
      <Button
        className={PRIMARY_CTA_CLASS}
        render={<Link to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} />}
      >
        Se connecter à Konodal
      </Button>
    )
  } else if (!isSuperAdmin) {
    content = <p className="text-sm text-muted-foreground">Ce connecteur est réservé aux administrateurs Konodal.</p>
  } else if (error) {
    content = <p className="text-sm text-red-700">{error}</p>
  } else if (clientName === null) {
    content = <p className="text-sm text-muted-foreground">Chargement de la demande…</p>
  } else {
    content = (
      <div className="flex flex-col gap-4">
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
          <li>lire les documents déposés dans « Créer avec Nodo » ;</li>
          <li>envoyer une proposition de résidence, que vous vérifiez dans le BO.</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Claude ne peut ni créer ni modifier une résidence. L'accès s'arrête si votre compte n'est plus administrateur.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button className={PRIMARY_CTA_CLASS} disabled={busy !== null} onClick={() => answer("approve")}>
            {busy === "approve" ? <LoaderCircle className="animate-spin" /> : <Check />}
            Autoriser
          </Button>
          <Button variant="outline" disabled={busy !== null} onClick={() => answer("deny")}>
            <X />
            Refuser
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center gap-3 text-center">
          <img src={logoVertical} alt="Konodal" className="h-[64px] w-auto" />
          <CardTitle className="flex items-center justify-center gap-2 text-lg">
            <ShieldCheck className="size-5 text-primary" />
            Connecter {clientName ?? "Claude"} à Konodal
          </CardTitle>
          <CardDescription>
            {user?.email ? `Connecté en tant que ${user.email}. ` : ""}
            {clientName !== null && `${clientName} demande à pouvoir, avec votre compte :`}
          </CardDescription>
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
    </div>
  )
}
