import { useState } from "react"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"
import { Timestamp } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DescriptionTextarea } from "@/components/DescriptionTextarea"
import { SearchableSelect } from "@/components/SearchableSelect"
import { createVote } from "@/lib/votes"
import { totalTantiemesForCleCharge } from "@/lib/voteResults"
import { GENERAL_CLEF_CHARGE_ID, type ClefCharge } from "@/types/clefCharge"
import type { Lot } from "@/types/lot"
import { MajoriteLegale, VoteType, majoriteLegaleLabels, type MajoriteLegaleValue, type Vote, type VoteQuestion } from "@/types/vote"
import { PRIMARY_CTA_CLASS, cn } from "@/lib/utils"

type VoteFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  residenceId: string
  uid: string
  lots: Lot[]
  clesCharge: ClefCharge[]
}

// Création d'un sondage ou d'une assemblée générale, réservée à la section
// Votes de ResidenceDetailPage - miroir simplifié de VoteForm côté app
// mobile (connectkasa, lib/vues/pages_vues/vote_page/vote_form.dart) : même
// modèle de données, même calcul de blocage sur les tantièmes, mais durée
// exprimée en une seule unité (secondes pour une question d'AG, heures pour
// un sondage) plutôt qu'un sélecteur d'unité - et pas de "Votes" simple
// (toujours la variante légale complète pour une assemblée générale, seul
// périmètre demandé côté backoffice).
export function VoteFormDialog({ open, onOpenChange, residenceId, uid, lots, clesCharge }: VoteFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {open && (
          <VoteFormDialogContent
            residenceId={residenceId}
            uid={uid}
            lots={lots}
            clesCharge={clesCharge}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

type OptionDraft = { id: string; label: string }

type QuestionDraft = {
  id: string
  text: string
  options: OptionDraft[]
  durationSeconds: number
  majoriteRequise: MajoriteLegaleValue
  cleChargeId: string
  passerelleActivee: boolean
}

function newQuestion(isSondage: boolean): QuestionDraft {
  return {
    id: crypto.randomUUID(),
    text: "",
    options: isSondage
      ? [{ id: crypto.randomUUID(), label: "" }, { id: crypto.randomUUID(), label: "" }]
      : [
          { id: crypto.randomUUID(), label: "Pour" },
          { id: crypto.randomUUID(), label: "Contre" },
          { id: crypto.randomUUID(), label: "Abstention" },
        ],
    durationSeconds: isSondage ? 60 : 30,
    majoriteRequise: MajoriteLegale.art25,
    cleChargeId: GENERAL_CLEF_CHARGE_ID,
    passerelleActivee: true,
  }
}

function VoteFormDialogContent({
  residenceId,
  uid,
  lots,
  clesCharge,
  onDone,
}: {
  residenceId: string
  uid: string
  lots: Lot[]
  clesCharge: ClefCharge[]
  onDone: () => void
}) {
  const [type, setType] = useState<Vote["type"]>(VoteType.assembleeGenerale)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [questions, setQuestions] = useState<QuestionDraft[]>([newQuestion(false)])
  const [sondageDurationHours, setSondageDurationHours] = useState("24")
  const [submitting, setSubmitting] = useState(false)

  const isSondage = type === VoteType.sondage

  function switchType(nextType: Vote["type"]) {
    setType(nextType)
    setQuestions([newQuestion(nextType === VoteType.sondage)])
  }

  function updateQuestion(index: number, patch: Partial<QuestionDraft>) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)))
  }

  function updateOption(qIndex: number, oIndex: number, label: string) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i !== qIndex ? q : { ...q, options: q.options.map((o, j) => (j === oIndex ? { ...o, label } : o)) }
      )
    )
  }

  function addOption(qIndex: number) {
    setQuestions((prev) =>
      prev.map((q, i) => (i !== qIndex ? q : { ...q, options: [...q.options, { id: crypto.randomUUID(), label: "" }] }))
    )
  }

  function removeOption(qIndex: number, oIndex: number) {
    setQuestions((prev) =>
      prev.map((q, i) => (i !== qIndex ? q : { ...q, options: q.options.filter((_, j) => j !== oIndex) }))
    )
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, newQuestion(false)])
  }

  function removeQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index))
  }

  // Garde-fou : une assemblée générale ne doit jamais pouvoir être créée
  // tant que les tantièmes d'une clé de charge référencée par une question
  // sont à 0 - le calcul de majorité pondérée serait sinon dénué de sens.
  function tantiemesBlockReason(): string | null {
    if (isSondage) return null
    for (const q of questions) {
      if (totalTantiemesForCleCharge(q.cleChargeId, lots, clesCharge) <= 0) {
        return "Une question référence une clé de charge sans aucun tantième - renseignez les tantièmes des lots concernés avant de créer cette assemblée générale."
      }
    }
    return null
  }

  function canSubmit(): boolean {
    if (!title.trim() || questions.length === 0) return false
    for (const q of questions) {
      if (!q.text.trim()) return false
      if (q.options.filter((o) => o.label.trim()).length < 2) return false
    }
    if (tantiemesBlockReason() != null) return false
    return true
  }

  async function handleSubmit() {
    if (!canSubmit() || submitting) return
    setSubmitting(true)
    try {
      const now = Timestamp.now()
      const voteQuestions: VoteQuestion[] = questions.map((q) => ({
        id: q.id,
        text: q.text.trim(),
        options: q.options.filter((o) => o.label.trim()).map((o) => ({ id: o.id, label: o.label.trim() })),
        durationSeconds: isSondage ? 60 : Math.max(30, q.durationSeconds || 30),
        majoriteRequise: isSondage ? null : q.majoriteRequise,
        cleChargeId: isSondage ? GENERAL_CLEF_CHARGE_ID : q.cleChargeId,
        sourceQuestionId: null,
        passerelleActivee: q.passerelleActivee,
        startedAt: null,
      }))
      const closingAt = isSondage
        ? Timestamp.fromMillis(now.toMillis() + (Number(sondageDurationHours) || 24) * 3600 * 1000)
        : Timestamp.fromMillis(now.toMillis() + 30 * 86400 * 1000)
      const vote: Vote = {
        id: crypto.randomUUID(),
        residenceId,
        type,
        title: title.trim(),
        description: isSondage ? "" : description.trim(),
        questions: voteQuestions,
        createdBy: uid,
        createdAt: now,
        closingAt,
        startedAt: null,
        pausedAt: null,
        nonResponseLots: {},
      }
      await createVote(residenceId, vote)
      toast.success(isSondage ? "Sondage créé" : "Assemblée générale créée")
      onDone()
    } catch (err) {
      toast.error("Échec de la création : " + (err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const blockReason = tantiemesBlockReason()

  return (
    <div className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4 p-[3px]">
      <DialogHeader className="border-b border-[oklch(95%_0.003_100)] pb-4">
        <DialogTitle>Nouveau sondage / assemblée générale</DialogTitle>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden pr-4 pl-[5px]">
        <div className="flex flex-col gap-1.5">
          <Label>Type</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => switchType(VoteType.sondage)}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                isSondage ? "border-transparent bg-primary text-primary-foreground" : "border-input text-muted-foreground"
              )}
            >
              Sondage
            </button>
            <button
              type="button"
              onClick={() => switchType(VoteType.assembleeGenerale)}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                !isSondage ? "border-transparent bg-primary text-primary-foreground" : "border-input text-muted-foreground"
              )}
            >
              Assemblée générale
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vote-title">Titre</Label>
          <Input id="vote-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex : AG ordinaire 2026" />
        </div>

        {isSondage ? (
          <>
            <div className="flex flex-col gap-1.5">
              <Label>Question</Label>
              <DescriptionTextarea rows={2} value={questions[0].text} onChange={(v) => updateQuestion(0, { text: v })} />
            </div>
            <OptionsEditor
              options={questions[0].options}
              onChange={(label, i) => updateOption(0, i, label)}
              onAdd={() => addOption(0)}
              onRemove={questions[0].options.length > 2 ? (i) => removeOption(0, i) : undefined}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vote-duration">Durée avant clôture (heures)</Label>
              <Input
                id="vote-duration"
                type="number"
                min={1}
                value={sondageDurationHours}
                onChange={(e) => setSondageDurationHours(e.target.value)}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vote-description">Description</Label>
              <DescriptionTextarea id="vote-description" rows={3} value={description} onChange={setDescription} />
            </div>

            {questions.map((q, i) => (
              <div key={q.id} className="flex flex-col gap-3 rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <Label>Question {i + 1}</Label>
                  {questions.length > 1 && (
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeQuestion(i)}>
                      <Trash2 />
                    </Button>
                  )}
                </div>
                <DescriptionTextarea rows={2} value={q.text} onChange={(v) => updateQuestion(i, { text: v })} />
                <OptionsEditor
                  options={q.options}
                  onChange={(label, oi) => updateOption(i, oi, label)}
                  onAdd={() => addOption(i)}
                  onRemove={q.options.length > 2 ? (oi) => removeOption(i, oi) : undefined}
                />
                <p className="text-xs text-muted-foreground">
                  La 1ère option compte légalement comme "Pour", la 2ème comme "Contre".
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label>Majorité légale requise</Label>
                    <SearchableSelect
                      value={q.majoriteRequise}
                      onChange={(v) => updateQuestion(i, { majoriteRequise: v as MajoriteLegaleValue })}
                      groups={[
                        {
                          options: Object.entries(majoriteLegaleLabels).map(([value, label]) => ({ value, label })),
                        },
                      ]}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Clé de charge concernée</Label>
                    <SearchableSelect
                      value={q.cleChargeId}
                      onChange={(v) => updateQuestion(i, { cleChargeId: v })}
                      groups={[
                        {
                          options: [
                            { value: GENERAL_CLEF_CHARGE_ID, label: "Générale (tous les lots)" },
                            ...clesCharge.map((c) => ({ value: c.id, label: c.nom || c.id })),
                          ],
                        },
                      ]}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`vote-q-duration-${q.id}`}>Durée de la question (secondes)</Label>
                    <Input
                      id={`vote-q-duration-${q.id}`}
                      type="number"
                      min={30}
                      value={q.durationSeconds}
                      onChange={(e) => updateQuestion(i, { durationSeconds: Number(e.target.value) || 30 })}
                    />
                  </div>
                  {(q.majoriteRequise === MajoriteLegale.art25 || q.majoriteRequise === MajoriteLegale.art26) && (
                    <label className="flex items-end gap-2 pb-1.5 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-input"
                        checked={q.passerelleActivee}
                        onChange={(e) => updateQuestion(i, { passerelleActivee: e.target.checked })}
                      />
                      Autoriser la passerelle {q.majoriteRequise === MajoriteLegale.art25 ? "25-1" : "26-1"}
                    </label>
                  )}
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" onClick={addQuestion} className="w-fit">
              <Plus />
              Ajouter une question
            </Button>

            {blockReason && <p className="text-sm text-destructive">{blockReason}</p>}
          </>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button type="button" className={PRIMARY_CTA_CLASS} onClick={handleSubmit} disabled={!canSubmit() || submitting}>
          Créer
        </Button>
      </DialogFooter>
    </div>
  )
}

function OptionsEditor({
  options,
  onChange,
  onAdd,
  onRemove,
}: {
  options: OptionDraft[]
  onChange: (label: string, index: number) => void
  onAdd: () => void
  onRemove?: (index: number) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((o, i) => (
        <div key={o.id} className="flex items-center gap-2">
          <Input
            className="min-w-0"
            placeholder={i === 0 ? "Ex : Pour" : i === 1 ? "Ex : Contre" : `Option ${i + 1}`}
            value={o.label}
            onChange={(e) => onChange(e.target.value, i)}
          />
          {onRemove && (
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => onRemove(i)}>
              <Trash2 />
            </Button>
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={onAdd} className="w-fit">
        <Plus />
        Ajouter une option
      </Button>
    </div>
  )
}
