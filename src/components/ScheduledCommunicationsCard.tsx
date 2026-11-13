import { useMemo, useState } from "react"
import { toast } from "sonner"
import { CalendarClock, ImageIcon, Link2, Save } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PublishAtFields } from "@/components/PublishAtFields"
import type { ScheduledCommunicationWithResidence } from "@/hooks/useScheduledCommunications"
import {
  AlreadyPublishedError,
  cancelScheduledCommunication,
  rescheduleCommunication,
} from "@/lib/communications"
import { formatPublishAt, publishAtError, toDateField, toPublishAt, toTimeField } from "@/lib/publishAt"
import { PRIMARY_CTA_CLASS } from "@/lib/utils"

type ScheduledGroup = {
  groupId: string
  title: string
  audience: ScheduledCommunicationWithResidence["audience"]
  publishAt: Date | null
  hasPhoto: boolean
  hasLink: boolean
  items: ScheduledCommunicationWithResidence[]
}

// Une ligne par envoi (copies d'une même soumission regroupées, cf.
// Communication.groupId), de la plus proche à la plus lointaine.
function groupScheduled(items: ScheduledCommunicationWithResidence[]): ScheduledGroup[] {
  const byGroup = new Map<string, ScheduledCommunicationWithResidence[]>()
  for (const item of items) byGroup.set(item.groupId, [...(byGroup.get(item.groupId) ?? []), item])
  return [...byGroup.values()]
    .map((group) => {
      const sorted = [...group].sort((a, b) => a.residenceName.localeCompare(b.residenceName, "fr"))
      const first = sorted[0]
      return {
        groupId: first.groupId,
        title: first.title,
        audience: first.audience,
        publishAt: first.publishAt,
        hasPhoto: sorted.some((c) => c.pathImage),
        hasLink: sorted.some((c) => c.link),
        items: sorted,
      }
    })
    .sort((a, b) => (a.publishAt?.getTime() ?? 0) - (b.publishAt?.getTime() ?? 0))
}

function errorMessage(err: unknown): string {
  return err instanceof AlreadyPublishedError ? err.message : "Échec : " + (err as Error).message
}

export function ScheduledCommunicationsCard({ items }: { items: ScheduledCommunicationWithResidence[] }) {
  const groups = useMemo(() => groupScheduled(items), [items])
  const [rescheduling, setRescheduling] = useState<ScheduledGroup | null>(null)
  const [cancelling, setCancelling] = useState<ScheduledGroup | null>(null)

  if (groups.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-4 text-primary" />
          Programmées ({groups.length})
        </CardTitle>
        <CardDescription>
          Publiées automatiquement à l'heure prévue ; les résidents sont notifiés à ce moment-là. Rien n'est visible
          dans l'app avant.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-[oklch(94%_0.005_100)]">
        {groups.map((group) => (
          <div key={group.groupId} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-1.5 font-medium">
                <span className="truncate">{group.title || "Sans titre"}</span>
                {group.audience === "proprietaires" && (
                  <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
                    Propriétaires
                  </Badge>
                )}
                {group.hasPhoto && <ImageIcon className="size-3.5 shrink-0 text-muted-foreground" aria-label="Avec photo" />}
                {group.hasLink && <Link2 className="size-3.5 shrink-0 text-muted-foreground" aria-label="Avec lien" />}
              </div>
              <span className="truncate text-sm text-muted-foreground" title={group.items.map((c) => c.residenceName).join(", ")}>
                {group.items.length > 1 ? `${group.items.length} résidences` : group.items[0].residenceName}
              </span>
            </div>
            <span className="text-sm font-semibold text-[oklch(38%_0.09_155)]">
              {group.publishAt ? formatPublishAt(group.publishAt) : "—"}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setRescheduling(group)}>
                Changer l'heure
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCancelling(group)}>
                Annuler la publication
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      <RescheduleDialog group={rescheduling} onClose={() => setRescheduling(null)} />
      <CancelDialog group={cancelling} onClose={() => setCancelling(null)} />
    </Card>
  )
}

function RescheduleDialog({ group, onClose }: { group: ScheduledGroup | null; onClose: () => void }) {
  return (
    <Dialog open={group !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {group && <RescheduleForm key={group.groupId} group={group} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function RescheduleForm({ group, onClose }: { group: ScheduledGroup; onClose: () => void }) {
  const initial = group.publishAt ?? new Date()
  const [date, setDate] = useState(toDateField(initial))
  const [time, setTime] = useState(toTimeField(initial))
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const publishAt = toPublishAt(date, time)
    const error = publishAtError(publishAt)
    if (error || !publishAt) {
      toast.error(error)
      return
    }
    setSaving(true)
    try {
      await Promise.all(group.items.map((item) => rescheduleCommunication(item, publishAt)))
      toast.success(`Publication programmée le ${formatPublishAt(publishAt)}`)
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <DialogHeader className="pb-4">
        <DialogTitle>Changer l'heure de publication</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          « {group.title || "Sans titre"} »
          {group.items.length > 1 ? `, dans ${group.items.length} résidences` : ""}
        </p>
        <PublishAtFields date={date} time={time} onDateChange={setDate} onTimeChange={setTime} disabled={saving} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Fermer
        </Button>
        <Button onClick={handleSave} disabled={saving} className={PRIMARY_CTA_CLASS}>
          <Save />
          Enregistrer
        </Button>
      </DialogFooter>
    </>
  )
}

function CancelDialog({ group, onClose }: { group: ScheduledGroup | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false)

  async function handleCancel() {
    if (!group) return
    setBusy(true)
    try {
      await Promise.all(group.items.map((item) => cancelScheduledCommunication(item)))
      toast.success("Publication annulée")
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={group !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pb-4">
          <DialogTitle>Annuler cette publication ?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          « {group?.title || "Sans titre"} » ne sera pas publiée
          {group && group.items.length > 1 ? ` (${group.items.length} résidences)` : ""}. Elle est supprimée, avec sa
          photo.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Garder
          </Button>
          <Button variant="destructive" onClick={handleCancel} disabled={busy}>
            Annuler la publication
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
