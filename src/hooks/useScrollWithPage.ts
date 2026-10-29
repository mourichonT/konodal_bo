import { useEffect, type RefObject } from "react"

function clamp(value: number, max: number) {
  return Math.min(Math.max(value, 0), max)
}

// Menu plus haut que la fenêtre, sans barre de défilement à lui : il suit le
// défilement de la page (`page`, le <main> d'AppLayout, seul conteneur qui
// défile), du même nombre de pixels et dans les deux sens, jusqu'à montrer
// son bas ou son haut. La molette au-dessus du menu fait défiler la page ;
// quand la page ne peut plus défiler (page courte), elle déplace le menu
// seul. Un lien atteint au clavier est ramené dans la fenêtre.
// `frame` : partie visible (overflow: clip, jamais défilée par le
// navigateur) ; `content` : colonne du menu, décalée par translateY.
export function useScrollWithPage(
  frame: RefObject<HTMLElement | null>,
  content: RefObject<HTMLElement | null>,
  page: RefObject<HTMLElement | null> | undefined
) {
  useEffect(() => {
    const frameEl = frame.current
    const contentEl = content.current
    const pageEl = page?.current
    if (!frameEl || !contentEl || !pageEl) return

    let offset = 0
    let overflow = 0
    let lastTop = pageEl.scrollTop
    const apply = () => {
      contentEl.style.transform = offset ? `translateY(${-offset}px)` : ""
    }
    const move = (delta: number) => {
      offset = clamp(offset + delta, overflow)
      apply()
    }
    const measure = () => {
      overflow = Math.max(0, contentEl.offsetHeight - frameEl.clientHeight)
      move(0)
    }
    const onPageScroll = () => {
      move(pageEl.scrollTop - lastTop)
      lastTop = pageEl.scrollTop
    }
    const onWheel = (event: WheelEvent) => {
      const delta =
        event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * pageEl.clientHeight : event.deltaY
      const room = delta > 0 ? pageEl.scrollHeight - pageEl.clientHeight - pageEl.scrollTop : pageEl.scrollTop
      if (room > 0) pageEl.scrollBy({ top: delta })
      else move(delta)
    }
    const onFocusIn = (event: FocusEvent) => {
      const target = (event.target as HTMLElement).getBoundingClientRect()
      const visible = frameEl.getBoundingClientRect()
      if (target.bottom > visible.bottom) move(target.bottom - visible.bottom + 8)
      else if (target.top < visible.top) move(target.top - visible.top - 8)
    }

    const observer = new ResizeObserver(measure)
    observer.observe(frameEl)
    observer.observe(contentEl)
    pageEl.addEventListener("scroll", onPageScroll, { passive: true })
    frameEl.addEventListener("wheel", onWheel, { passive: true })
    frameEl.addEventListener("focusin", onFocusIn)
    measure()
    return () => {
      observer.disconnect()
      pageEl.removeEventListener("scroll", onPageScroll)
      frameEl.removeEventListener("wheel", onWheel)
      frameEl.removeEventListener("focusin", onFocusIn)
      contentEl.style.transform = ""
    }
  }, [frame, content, page])
}
