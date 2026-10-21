import { cn } from "@/lib/utils"
import { buildingShortName } from "@/types/lot"
import type { GedFoundDocument } from "@/types/ged"

// Vignette du type de fichier (maquette : « PDF » sur fond rosé).
export function FileTypeIcon({ extension, className }: { extension: string; className?: string }) {
  const ext = (extension || "fichier").toUpperCase().slice(0, 4)
  const tone =
    ext === "PDF"
      ? "bg-[#FBE7E4] text-[#BF3A2B]"
      : ["JPG", "JPEG", "PNG", "HEIC", "WEBP"].includes(ext)
        ? "bg-[#E6F2EA] text-[#2F7A52]"
        : ["DOC", "DOCX", "ODT", "TXT"].includes(ext)
          ? "bg-[#E5EDFA] text-[#2D5AA6]"
          : "bg-muted text-muted-foreground"
  return (
    <span
      className={cn(
        "flex h-9 w-8 shrink-0 items-center justify-center rounded-md border border-black/5 text-[9px] font-bold",
        tone,
        className
      )}
    >
      {ext}
    </span>
  )
}

// « Carré Salambo › Bât D › Réf. 126 » / « … › Docs de résidence ».
export function foundPath(found: GedFoundDocument): string {
  const parts = [found.residenceName]
  if (found.scope === "lot") {
    const building = buildingShortName(found.lot?.batiment ?? "")
    if (building) parts.push(building.length <= 2 ? `Bât ${building}` : building)
    const ref = (found.lot?.refLot ?? "").replace(/^0+(?=\d)/, "")
    parts.push(ref ? `Réf. ${ref}` : "Lot")
  } else if (found.scope === "building") {
    parts.push(found.batiment)
  } else {
    parts.push("Docs de résidence")
  }
  return parts.filter(Boolean).join(" › ")
}

// Mots cherchés surlignés dans un extrait (maquette 3a), sans tenir compte
// des accents ni de la casse.
export function Highlighted({ text, query }: { text: string; query: string }) {
  const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  let folded = ""
  const origin: number[] = []
  for (let i = 0; i < text.length; i++) {
    for (const c of fold(text[i])) {
      folded += c
      origin.push(i)
    }
  }
  const marked = new Array<boolean>(text.length).fill(false)
  for (const word of query.split(/\s+/).map(fold).filter((w) => w.length > 1)) {
    for (let at = folded.indexOf(word); at >= 0; at = folded.indexOf(word, at + word.length)) {
      for (let k = at; k < at + word.length; k++) marked[origin[k]] = true
    }
  }
  const parts: { text: string; mark: boolean }[] = []
  for (let i = 0; i < text.length; i++) {
    const last = parts[parts.length - 1]
    if (last && last.mark === marked[i]) last.text += text[i]
    else parts.push({ text: text[i], mark: marked[i] })
  }
  return (
    <>
      {parts.map((part, i) =>
        part.mark ? (
          <mark key={i} className="rounded-sm bg-[#FFF1A8] px-0.5 font-semibold text-inherit">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  )
}

export function formatDate(date: Date | null): string {
  return date ? date.toLocaleDateString("fr-FR") : "—"
}
