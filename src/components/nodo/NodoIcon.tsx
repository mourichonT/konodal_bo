// Icône "croisement" de Nodo (maquette Icone Assistant Croisement) : quatre
// cercles reliés en diagonale.
export function NodoIcon({ className, color = "currentColor" }: { className?: string; color?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M2.9 6.5a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0 -7.2 0" />
      <path d="M13.9 17.5a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0 -7.2 0" />
      <path d="M14.9 6.5a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0" />
      <path d="M3.9 17.5a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0" />
      <path d="M9.05 9.05L14.95 14.95" />
      <path d="M15.66 8.34L13.6 10.4" />
      <path d="M10.4 13.6L8.34 15.66" />
      <circle cx="6.5" cy="6.5" r="1.7" fill={color} stroke="none" />
      <circle cx="17.5" cy="17.5" r="1.7" fill={color} stroke="none" />
      <circle cx="17.5" cy="6.5" r="1.2" fill={color} stroke="none" />
      <circle cx="6.5" cy="17.5" r="1.2" fill={color} stroke="none" />
    </svg>
  )
}
