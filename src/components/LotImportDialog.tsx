import { useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, CheckCircle2, Download, Upload, UploadCloud } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PRIMARY_CTA_CLASS } from "@/lib/utils"
import {
  downloadLotImportTemplateCsv,
  downloadLotImportTemplateXlsx,
  mapLotImportHeaders,
  parseLotImportFile,
  validateLotImportRows,
  type LotImportValidation,
} from "@/lib/lotImportExport"

const ACCEPTED_FILE_TYPES = ".xlsx,.csv"

type LotImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingLots: { refLot: string; batiment: string; lot: string }[]
  onImport: (validation: LotImportValidation) => Promise<void>
}

// Même patron que les autres modales de formulaire : contenu monté
// seulement quand ouverte, pour repartir d'un état vierge à chaque fois.
export function LotImportDialog({ open, onOpenChange, existingLots, onImport }: LotImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && (
          <LotImportDialogContent
            existingLots={existingLots}
            onImport={onImport}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function LotImportDialogContent({
  existingLots,
  onImport,
  onDone,
}: {
  existingLots: { refLot: string; batiment: string; lot: string }[]
  onImport: (validation: LotImportValidation) => Promise<void>
  onDone: () => void
}) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [headerErrors, setHeaderErrors] = useState<string[]>([])
  const [validation, setValidation] = useState<LotImportValidation | null>(null)
  const [importing, setImporting] = useState(false)

  async function handleFileSelected(file: File) {
    setFileName(file.name)
    setValidation(null)
    setHeaderErrors([])
    setParsing(true)
    try {
      const { headers, rows } = await parseLotImportFile(file)
      const { rows: mappedRows, headerErrors: mapErrors } = mapLotImportHeaders(headers, rows)
      if (mapErrors.length > 0) {
        setHeaderErrors(mapErrors)
        return
      }
      setValidation(validateLotImportRows(mappedRows, existingLots))
    } catch (err) {
      toast.error("Impossible de lire le fichier : " + (err as Error).message)
    } finally {
      setParsing(false)
    }
  }

  async function handleConfirm() {
    if (!validation || validation.toCreate.length === 0) return
    setImporting(true)
    try {
      await onImport(validation)
      toast.success(`${validation.toCreate.length} lot${validation.toCreate.length > 1 ? "s" : ""} importé${validation.toCreate.length > 1 ? "s" : ""}`)
      onDone()
    } catch (err) {
      toast.error("Échec de l'import : " + (err as Error).message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4 p-[3px]">
      <DialogHeader className="border-b border-[oklch(95%_0.003_100)] pb-4">
        <span className="text-[11.5px] font-bold tracking-wide text-primary uppercase">Lots</span>
        <DialogTitle>Importer des lots</DialogTitle>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden pr-4 pl-[5px]">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">1. Téléchargez le modèle à remplir</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={downloadLotImportTemplateXlsx}>
              <Download />
              Modèle .xlsx
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={downloadLotImportTemplateCsv}>
              <Download />
              Modèle .csv
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Colonnes : Bâtiment, N°, Référence (obligatoires), Type, Rattachable (Oui/Non).
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">2. Importez votre fichier rempli</p>
          <label
            htmlFor="lot-import-file"
            className="flex cursor-pointer flex-col items-center gap-2 rounded-[18px] border border-dashed border-input p-4 text-center text-sm text-muted-foreground hover:bg-muted/50"
          >
            <UploadCloud className="size-6" />
            {fileName ?? "Choisir un fichier .xlsx ou .csv (séparateur ;)"}
          </label>
          <input
            id="lot-import-file"
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFileSelected(file)
            }}
          />
        </div>

        {parsing && <p className="text-sm text-muted-foreground">Lecture du fichier...</p>}

        {headerErrors.length > 0 && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <div className="flex items-center gap-1.5 font-medium">
              <AlertTriangle className="size-4" />
              Le fichier ne correspond pas au modèle attendu
            </div>
            {headerErrors.map((e) => (
              <p key={e}>{e}</p>
            ))}
          </div>
        )}

        {validation && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle2 className="size-4 shrink-0" />
              {validation.toCreate.length} lot{validation.toCreate.length > 1 ? "s" : ""} prêt
              {validation.toCreate.length > 1 ? "s" : ""} à importer
            </div>

            {validation.duplicatesExisting.length > 0 && (
              <details className="rounded-lg border p-3 text-sm">
                <summary className="cursor-pointer font-medium text-muted-foreground">
                  {validation.duplicatesExisting.length} doublon
                  {validation.duplicatesExisting.length > 1 ? "s" : ""} ignoré
                  {validation.duplicatesExisting.length > 1 ? "s" : ""} (déjà en base)
                </summary>
                <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                  {validation.duplicatesExisting.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </details>
            )}

            {validation.duplicatesInFile.length > 0 && (
              <details className="rounded-lg border p-3 text-sm">
                <summary className="cursor-pointer font-medium text-muted-foreground">
                  {validation.duplicatesInFile.length} doublon
                  {validation.duplicatesInFile.length > 1 ? "s" : ""} ignoré
                  {validation.duplicatesInFile.length > 1 ? "s" : ""} (dans le fichier)
                </summary>
                <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                  {validation.duplicatesInFile.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </details>
            )}

            {validation.errors.length > 0 && (
              <details className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" open>
                <summary className="cursor-pointer font-medium">
                  {validation.errors.length} ligne{validation.errors.length > 1 ? "s" : ""} en erreur
                </summary>
                <ul className="mt-2 flex flex-col gap-1 text-xs">
                  {validation.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button
          type="button"
          disabled={!validation || validation.toCreate.length === 0 || importing}
          onClick={handleConfirm}
          className={PRIMARY_CTA_CLASS}
        >
          <Upload />
          Importer{validation && validation.toCreate.length > 0 ? ` (${validation.toCreate.length})` : ""}
        </Button>
      </DialogFooter>
    </div>
  )
}
