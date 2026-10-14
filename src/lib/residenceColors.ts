// Couleur propre à chaque résidence (aucune couleur stockée en base) :
// teinte pseudo-aléatoire dérivée de son id, donc stable - une résidence
// garde la même couleur partout et d'une session à l'autre, contrairement à
// un vrai tirage aléatoire qui changerait à chaque rendu. 360 teintes au
// lieu d'une palette fixe, en évitant les plages rouge et ambre réservées
// aux statuts (Bloqué, À traiter). Clair/foncé fixés pour garder un texte
// lisible sur le fond.
const RESERVED_HUES: [number, number][] = [
  [345, 360], // rouge
  [0, 15], // rouge
  [30, 55], // ambre
]
const ALLOWED_HUES = Array.from({ length: 360 }, (_, h) => h).filter(
  (h) => !RESERVED_HUES.some(([from, to]) => h >= from && h < to)
)

function hashOf(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0
  return Math.abs(hash)
}

function hslToHex(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100)
  const channel = (n: number) => {
    const k = (n + h / 30) % 12
    const value = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, "0")
  }
  return `#${channel(0)}${channel(8)}${channel(4)}`
}

export function residenceBadgeColors(residenceId: string): { background: string; color: string } {
  const hue = ALLOWED_HUES[hashOf(residenceId) % ALLOWED_HUES.length]
  return { background: hslToHex(hue, 70, 92), color: hslToHex(hue, 65, 28) }
}
