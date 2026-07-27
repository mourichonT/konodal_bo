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
  // Le build livré est hébergé sous konodal.com/portail/, pas à la racine du
  // site (site vitrine konodal_web, déployé séparément) - assets et routes
  // doivent donc être préfixés en conséquence. En local (`vite`/serve), on
  // reste à la racine : localhost:5173/ plutôt que localhost:5173/portail/.
  // React Router lit ce même préfixe via import.meta.env.BASE_URL (cf.
  // main.tsx), pas besoin de le dupliquer.
  base: command === 'build' ? '/portail/' : '/',
  // Vrai uniquement quand Vite *sert* l'app en local (`npm run dev` comme
  // `npm run dev:prod`), faux dans tout `vite build`. import.meta.env.DEV ne
  // convient pas : il vaut aussi true dans un build `--mode development`
  // (`npm run build:dev`), donc le repère d'environnement se retrouverait
  // dans un artefact déployable, face à de vrais utilisateurs. Inliné à la
  // compilation, donc le composant qui le teste est éliminé du bundle.
  define: { __DEV_SERVER__: JSON.stringify(command === 'serve') },
}))
