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

run("npm run build", repoRoot)
run("firebase deploy --only hosting:portail --project konodal-web", repoRoot)

console.log("\nDéployé sur https://portail.konodal.com (et https://konodal-portail.web.app)")
console.log("Pense à pousser konodal_bo.")
