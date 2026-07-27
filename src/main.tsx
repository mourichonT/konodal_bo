import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/lib/auth-context'
import './index.css'
import App from './App.tsx'

// BASE_URL se termine toujours par un slash (ex: "/portail/"), mais l'URL
// canonique servie par Firebase Hosting ne l'a jamais (trailingSlash: false
// côté konodal_web redirige "/portail/" vers "/portail") - un basename avec
// slash final ne matche donc jamais ce pathname réel (stripBasename exige
// une correspondance exacte de préfixe), et React Router ne route plus rien.
const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={routerBasename}>
      <AuthProvider>
        <App />
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
