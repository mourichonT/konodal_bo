import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Le build livré est servi à la racine de portail.konodal.com (site
  // Firebase Hosting konodal-portail, cf. firebase.json) : base par défaut
  // « / ». Le code passe quand même par import.meta.env.BASE_URL (main.tsx,
  // appBaseUrl), au cas où le BO repasserait sous un préfixe.
  // Vrai uniquement quand Vite *sert* l'app en local (`npm run dev` comme
  // `npm run dev:prod`), faux dans tout `vite build`. import.meta.env.DEV ne
  // convient pas : il vaut aussi true dans un build `--mode development`
  // (`npm run build:dev`), donc le repère d'environnement se retrouverait
  // dans un artefact déployable, face à de vrais utilisateurs. Inliné à la
  // compilation, donc le composant qui le teste est éliminé du bundle.
  define: { __DEV_SERVER__: JSON.stringify(command === 'serve') },
}))
