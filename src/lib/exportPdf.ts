// html2canvas-pro (pas html2canvas) : seul le fork "pro" sait parser les
// fonctions de couleur CSS Color 4 (oklch/lab/lch/color()) utilisées par
// Tailwind v4 (palette par défaut ET nos variables --background/--border/...
// dans index.css) - html2canvas standard plante avec "Attempting to parse
// an unsupported color function oklch" dès qu'il rencontre un style calculé
// dans ce format.
import html2canvas from "html2canvas-pro"
import jsPDF from "jspdf"

// Certaines images (ex: SinistreMediaViewer) résolvent leur URL de façon
// asynchrone (getDownloadURL) après le montage du composant - un
// setState juste avant l'export ne suffit pas à garantir que les <img>
// existent déjà, ni que leur contenu est chargé. Poll plutôt qu'un délai
// fixe : le nombre de photos varie d'un sinistre à l'autre.
export async function waitForImagesToLoad(
  container: HTMLElement,
  expectedCount: number,
  timeoutMs = 8000
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const images = Array.from(container.querySelectorAll("img"))
    if (images.length >= expectedCount && images.every((img) => img.complete && img.naturalWidth > 0)) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
}

const BOTTOM_MARGIN_PX = 20
const PX_TO_MM = 25.4 / 96

const HTML2CANVAS_OPTIONS = {
  scale: 2,
  backgroundColor: "#ffffff",
  useCORS: true,
  // Un rapport exporté est un document figé, pas une UI interactive : tout
  // <button> (export lui-même, dropdowns, actions de commentaires, bouton
  // "Voir l'intervention"...) n'a pas sa place dans le PDF généré, en plus
  // du marquage explicite data-pdf-ignore pour les cas non-<button>.
  ignoreElements: (el: Element) => el.hasAttribute("data-pdf-ignore") || el.tagName === "BUTTON",
} as const

// Place un canvas déjà capturé sur les pages du pdf, à partir de la position
// verticale courante (yMm sur la page en cours) - démarre une nouvelle page
// si le bloc ne tient pas dans l'espace restant. Si le bloc à lui seul
// dépasse la hauteur utilisable d'une page (rare), le découpe page par page
// (seul cas où une coupure au milieu du contenu est inévitable).
function placeCanvas(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  state: { yMm: number; hasContent: boolean },
  pageWidth: number,
  usableHeightMm: number
) {
  const canvasPxPerMm = canvas.width / pageWidth
  const heightMm = canvas.height / canvasPxPerMm

  if (state.hasContent && state.yMm + heightMm > usableHeightMm) {
    pdf.addPage()
    state.yMm = 0
  }

  if (heightMm <= usableHeightMm) {
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, state.yMm, pageWidth, heightMm)
    state.yMm += heightMm
    state.hasContent = true
    return
  }

  // Bloc plus haut qu'une page entière : découpe simple, uniquement ce bloc.
  let consumedPx = 0
  while (consumedPx < canvas.height - 1) {
    const remainingMm = usableHeightMm - state.yMm
    const slicePx = Math.min(canvas.height - consumedPx, Math.round(remainingMm * canvasPxPerMm))
    const sliceCanvas = document.createElement("canvas")
    sliceCanvas.width = canvas.width
    sliceCanvas.height = slicePx
    const ctx = sliceCanvas.getContext("2d")
    if (ctx) {
      ctx.drawImage(canvas, 0, consumedPx, canvas.width, slicePx, 0, 0, canvas.width, slicePx)
    }
    pdf.addImage(sliceCanvas.toDataURL("image/png"), "PNG", 0, state.yMm, pageWidth, slicePx / canvasPxPerMm)
    consumedPx += slicePx
    state.yMm += slicePx / canvasPxPerMm
    state.hasContent = true
    if (consumedPx < canvas.height) {
      pdf.addPage()
      state.yMm = 0
    }
  }
}

// Capture un élément DOM en PDF. Si l'élément contient des descendants
// marqués data-pdf-block (ex: SinistreDetailPage : Ticket, chaque
// Déclarant, chaque photo, les commentaires), chacun est capturé et placé
// SÉPARÉMENT - un bloc n'est jamais coupé par un saut de page, la pagination
// passe au bloc suivant dès qu'un bloc ne tient plus dans l'espace restant.
// Sans marquage (ex: AdCampaignDetailPage), l'élément entier est capturé et
// paginé comme un seul bloc, comme avant.
export async function exportElementToPdf(element: HTMLElement, filename: string): Promise<void> {
  const markedBlocks = Array.from(element.querySelectorAll<HTMLElement>("[data-pdf-block]"))
  const blocks = markedBlocks.length > 0 ? markedBlocks : [element]

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const usableHeightMm = pageHeight - BOTTOM_MARGIN_PX * PX_TO_MM

  const state = { yMm: 0, hasContent: false }
  for (const block of blocks) {
    const canvas = await html2canvas(block, HTML2CANVAS_OPTIONS)
    placeCanvas(pdf, canvas, state, pageWidth, usableHeightMm)
  }

  pdf.save(filename)
}
