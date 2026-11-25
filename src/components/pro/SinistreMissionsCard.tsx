import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { CheckCircle2, ChevronDown, ChevronUp, FileText, Send, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/auth-context"
import {
  cancelProMission,
  decideProDevis,
  markProMissionRead,
  missionStatusLine,
  openProFacture,
  PRO_MISSION_LABELS,
  sendProMessage,
  setProFactureStatut,
  subscribeToMissionDevis,
  subscribeToMissionFinance,
  subscribeToMissionMessages,
  subscribeToSinistreMissions,
  type ProDevis,
  type ProMessage,
  type ProMission,
  type ProMissionFinance,
} from "@/lib/proAccounts"

const ACTIVE = new Set(["proposee", "acceptee", "planifiee"])
const FACTURE_LABELS = { envoyee: "Envoyée", bon_a_payer: "Bon à payer", payee: "Payée" } as const

const euros = (value: number | null | undefined) =>
  value == null ? "—" : value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })

// Missions Konodal Pro du sinistre (pro_create_mission) : prestataire,
// statut, date prévue ; devis transmis (accepter / refuser), facture (bon à
// payer, payée) et fil de messages avec l'entreprise ; annulation.
export function SinistreMissionsCard({ residenceId, sinistreId }: { residenceId: string; sinistreId: string }) {
  const [missions, setMissions] = useState<ProMission[]>([])
  const [open, setOpen] = useState<string | null>(null)

  useEffect(
    () =>
      subscribeToSinistreMissions(residenceId, sinistreId, setMissions, (error) =>
        toast.error("Impossible de charger les missions : " + error.message)
      ),
    [residenceId, sinistreId]
  )

  if (missions.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Demandes d'intervention</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {missions.map((m) => (
          <MissionRow key={m.id} mission={m} open={open === m.id} onToggle={() => setOpen(open === m.id ? null : m.id)} />
        ))}
      </CardContent>
    </Card>
  )
}

function MissionRow({ mission: m, open, onToggle }: { mission: ProMission; open: boolean; onToggle: () => void }) {
  async function handleCancel() {
    const reason = window.prompt(
      `Annuler la demande faite à ${m.contactName} ? Motif (envoyé au prestataire, facultatif) :`
    )
    if (reason === null) return
    try {
      await cancelProMission(m.id, reason)
      toast.success("Demande annulée")
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  // Devis, facture et messages n'existent que dans Konodal Pro.
  const expandable = m.canal === "pro"
  const statusLine = missionStatusLine(m)
  return (
    <div className="flex flex-col gap-2 border-b pb-3 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          className="flex flex-col gap-0.5 text-left disabled:cursor-default"
          onClick={onToggle}
          disabled={!expandable}
        >
          <span className="flex items-center gap-1.5 font-medium">
            {m.contactName}
            {m.numero && <span className="text-xs text-muted-foreground">{m.numero}</span>}
            {expandable && (open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />)}
          </span>
          {statusLine && <span className="text-muted-foreground">{statusLine}</span>}
          <span className="text-xs text-muted-foreground">
            {m.canal === "lien" ? `Par mail${m.contactMail ? ` (${m.contactMail})` : ""}` : "Konodal Pro"}
            {m.createdByName ? ` · mandatée par ${m.createdByName}` : ""}
          </span>
        </button>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap justify-end gap-1">
            <Badge variant="secondary">{PRO_MISSION_LABELS[m.statut] ?? m.statut}</Badge>
            {m.devisStatut === "envoye" && (
              <Badge variant="outline" className="border-transparent bg-sky-100 text-sky-800">
                Devis à valider
              </Badge>
            )}
            {m.unreadSyndic > 0 && (
              <Badge className="bg-emerald-700 text-white">
                {m.unreadSyndic} message{m.unreadSyndic > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          {ACTIVE.has(m.statut) && (
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Annuler
            </Button>
          )}
        </div>
      </div>
      {open && expandable && <MissionDetail mission={m} />}
    </div>
  )
}

function MissionDetail({ mission: m }: { mission: ProMission }) {
  const { user } = useAuth()
  const [devis, setDevis] = useState<ProDevis[]>([])
  const [finance, setFinance] = useState<ProMissionFinance | null>(null)
  const [messages, setMessages] = useState<ProMessage[]>([])
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => subscribeToMissionDevis(m.id, setDevis), [m.id])
  useEffect(() => subscribeToMissionFinance(m.id, setFinance), [m.id])
  useEffect(() => subscribeToMissionMessages(m.id, setMessages), [m.id])
  useEffect(() => {
    if (m.unreadSyndic > 0) void markProMissionRead(m.id).catch(() => undefined)
  }, [m.id, m.unreadSyndic])

  // PDF reçu par mail ; pas encore envoyé : le motif du serveur.
  async function openPdf(factureId: string) {
    try {
      await openProFacture(m.id, factureId)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    try {
      await action()
      toast.success(success)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleRefuse(d: ProDevis) {
    const reason = window.prompt("Motif du refus (envoyé au prestataire) :")
    if (!reason) return
    await run(() => decideProDevis(m.id, d.id, false, reason), "Devis refusé")
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    if (!user || !text.trim()) return
    const value = text.trim()
    setText("")
    try {
      await sendProMessage(m.id, user.uid, user.displayName || user.email || "Syndic", value)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted/40 p-3">
      {devis.length === 0 && <p className="text-muted-foreground">Aucun devis transmis pour l'instant.</p>}
      {devis.map((d) => (
        <div key={d.id} className="flex flex-col gap-1.5 rounded-md border bg-background p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">
              Devis {d.numero} · {euros(d.totalTTC)} TTC
            </span>
            <Badge variant="secondary">
              {d.statut === "envoye" ? "À valider" : d.statut === "accepte" ? "Accepté" : "Refusé"}
            </Badge>
          </div>
          <ul className="text-xs text-muted-foreground">
            {d.lignes.map((l, i) => (
              <li key={i}>
                {l.designation} · {l.qte} {l.unite} × {euros(l.puHT)} HT (TVA {l.tva} %) = {euros(l.totalHT)} HT
              </li>
            ))}
          </ul>
          <span className="text-xs">
            Total HT {euros(d.totalHT)}
            {Object.entries(d.tva).map(([rate, amount]) => ` · TVA ${rate} % ${euros(amount)}`)}
          </span>
          {d.statut === "refuse" && d.refusalReason && (
            <span className="text-xs text-muted-foreground">Motif : {d.refusalReason}</span>
          )}
          {d.statut === "envoye" && (
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => run(() => decideProDevis(m.id, d.id, true), "Devis accepté")}>
                <CheckCircle2 />
                Accepter le devis
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => handleRefuse(d)}>
                <XCircle />
                Refuser
              </Button>
            </div>
          )}
        </div>
      ))}

      {finance?.factureNumero && (
        <div className="flex flex-col gap-1.5 rounded-md border bg-background p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">
              Facture {finance.factureNumero} · {euros(finance.factureTTC)} TTC
            </span>
            {finance.factureStatut && <Badge variant="secondary">{FACTURE_LABELS[finance.factureStatut]}</Badge>}
          </div>
          {finance.echeance && (
            <span className="text-xs text-muted-foreground">
              Échéance le {finance.echeance.toLocaleDateString("fr-FR")}
              {finance.paidAt && ` · payée le ${finance.paidAt.toLocaleDateString("fr-FR")}`}
              {finance.factureRelanceeAt && ` · relance du prestataire le ${finance.factureRelanceeAt.toLocaleDateString("fr-FR")}`}
            </span>
          )}
          <div className="flex flex-wrap gap-2">
            {finance.factureId && (
              <Button size="sm" variant="outline" onClick={() => openPdf(finance.factureId!)}>
                <FileText />
                Voir la facture (PDF)
              </Button>
            )}
            {finance.factureStatut === "envoyee" && (
              <Button size="sm" disabled={busy} onClick={() => run(() => setProFactureStatut(m.id, "bon_a_payer"), "Bon à payer")}>
                Bon à payer
              </Button>
            )}
            {finance.factureStatut !== "payee" && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => setProFactureStatut(m.id, "payee"), "Facture payée")}>
                Marquer payée
              </Button>
            )}
          </div>
        </div>
      )}

      {finance?.avoirs.map((a) => (
        <div key={a.avoirId} className="flex items-center justify-between gap-2 rounded-md border bg-background p-2.5">
          <span className="text-muted-foreground">
            Facture {a.factureNumero} annulée par l'avoir {a.avoirNumero}
            {a.totalTTC != null && ` · −${euros(a.totalTTC)} TTC`}
          </span>
          <Button size="sm" variant="outline" onClick={() => openPdf(a.avoirId)}>
            <FileText />
            Voir l'avoir
          </Button>
        </div>
      ))}

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase text-muted-foreground">Messages avec l'entreprise</span>
        <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
          {messages.length === 0 && <p className="text-xs text-muted-foreground">Aucun message.</p>}
          {messages.map((msg) =>
            msg.side === "system" ? (
              <p key={msg.id} className="self-center rounded-md border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                {msg.text}
              </p>
            ) : (
              <p
                key={msg.id}
                className={
                  msg.side === "syndic"
                    ? "max-w-[85%] self-end rounded-lg bg-emerald-700 px-2.5 py-1.5 text-white"
                    : "max-w-[85%] self-start rounded-lg bg-background px-2.5 py-1.5"
                }
              >
                {msg.side === "pro" && <span className="block text-xs font-semibold">{msg.authorName}</span>}
                {msg.text}
              </p>
            )
          )}
        </div>
        <form className="flex gap-2" onSubmit={handleSend}>
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Écrire à l'entreprise…" />
          <Button type="submit" size="sm" disabled={!text.trim()}>
            <Send />
          </Button>
        </form>
      </div>
    </div>
  )
}
