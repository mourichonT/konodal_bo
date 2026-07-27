// Mise en prod du BO sous konodal.com/portail : build (données konodal-prod,
// chemins préfixés /portail/), copie dans le dépôt du site vitrine
// (konodal_web, sibling de ce repo, déployé séparément via Firebase Hosting
// - cf. firebase.json qui y insère une règle /portail/** avant le catch-all
// de maintenance), puis déploiement. Node plutôt que shell : tourne pareil
// en Git Bash et en PowerShell.
import { execSync } from "node:child_process"
import { cpSync, existsSync, rmSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const webRepo = resolve(repoRoot, "../konodal_web")
const portailDir = resolve(webRepo, "portail")

if (!existsSync(webRepo)) {
  console.error(`Dépôt konodal_web introuvable à côté de celui-ci : ${webRepo}`)
  process.exit(1)
}

function run(command, cwd) {
  console.log(`\n$ ${command}`)
  execSync(command, { cwd, stdio: "inherit" })
}

run("npm run build", repoRoot)

rmSync(portailDir, { recursive: true, force: true })
cpSync(resolve(repoRoot, "dist"), portailDir, { recursive: true })

run("firebase deploy --only hosting --project konodal-web", webRepo)

console.log("\nDéployé sur https://konodal.com/portail")
console.log(
  "Pense à committer konodal_web/portail/ (pas de remote sur ce dépôt, le déploiement fait foi) et à pousser konodal_bo."
)
