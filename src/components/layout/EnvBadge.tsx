// Repère "dev" affiché uniquement quand le BO est servi en local (cf.
// __DEV_SERVER__ dans vite.config.ts) ET pointe sur konodal-dev - rien
// n'apparaît sur konodal-prod (`npm run dev:prod`), ni a fortiori pour un
// utilisateur du backoffice déployé, le composant étant retiré du bundle à la
// compilation.
export function EnvBadge() {
  if (!__DEV_SERVER__) return null

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined
  if (projectId !== "konodal-dev") return null

  return (
    <span
      title={`Backoffice servi en local sur ${projectId}`}
      className="ml-auto rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-950 uppercase"
    >
      dev
    </span>
  )
}
