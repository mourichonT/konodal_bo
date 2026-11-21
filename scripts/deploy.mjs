// Mise en prod du BO sur portail.konodal.com : build (données konodal-prod),
// puis déploiement sur le site Firebase Hosting konodal-portail du projet
// konodal-web (cible « portail », cf. firebase.json et .firebaserc). Le site
// vitrine konodal_web n'est plus publié ici : il redirige konodal.com/portail
// vers ce site. Node plutôt que shell : tourne pareil en Git Bash et en
// PowerShell.
import { execSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

function run(command, cwd) {
  console.log(`\n$ ${command}`)
  execSync(command, { cwd, stdio: "inherit" })
}

// La prod se publie depuis master uniquement : une branche en cours (ex.
// feat/konodal-pro, qui dépend d'un serveur pas encore déployé) mettrait en
// ligne des écrans qui échouent.
const branch = execSync("git branch --show-current", { cwd: repoRoot }).toString().trim()
if (branch !== "master") {
  console.error(`\nPublication refusée : konodal_bo est sur la branche « ${branch} ».`)
  console.error("Repasse sur master (git switch master), puis relance npm run deploy.")
  process.exit(1)
}

run("npm run build", repoRoot)
run("firebase deploy --only hosting:portail --project konodal-web", repoRoot)

console.log("\nDéployé sur https://portail.konodal.com (et https://konodal-portail.web.app)")
console.log("Pense à pousser konodal_bo.")
