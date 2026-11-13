import { Routes, Route, Navigate, useSearchParams } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { RequireSuperAdmin } from "@/components/RequireSuperAdmin"
import LoginPage from "@/pages/LoginPage"
import RegisterPage from "@/pages/RegisterPage"
import ResetPasswordPage from "@/pages/ResetPasswordPage"
import DashboardPage from "@/pages/DashboardPage"
import ResidenceDetailPage from "@/pages/ResidenceDetailPage"
import LotDetailPage from "@/pages/LotDetailPage"
import VoteDetailPage from "@/pages/VoteDetailPage"
import UsersLayout from "@/pages/UsersLayout"
import ResidentDetailPage from "@/pages/ResidentDetailPage"
import SinistresPage from "@/pages/SinistresPage"
import SinistresKanbanPage from "@/pages/SinistresKanbanPage"
import SinistresListPage from "@/pages/SinistresListPage"
import SinistreDetailPage from "@/pages/SinistreDetailPage"
import EvenementsPage from "@/pages/EvenementsPage"
import EvenementsListPage from "@/pages/EvenementsListPage"
import EvenementsCalendarPage from "@/pages/EvenementsCalendarPage"
import EvenementDetailPage from "@/pages/EvenementDetailPage"
import CommunicationsPage from "@/pages/CommunicationsPage"
import CommunicationDetailPage from "@/pages/CommunicationDetailPage"
import AgencesPage, { AgenceDetailPage } from "@/pages/AgencesPage"
import ContactsPage from "@/pages/ContactsPage"
import ContactDetailPage from "@/pages/ContactDetailPage"
import DocumentsPage from "@/pages/DocumentsPage"
import MessagesPage from "@/pages/MessagesPage"
import ProfilePage from "@/pages/ProfilePage"
import SharedInterventionPage from "@/pages/SharedInterventionPage"
import OfferPage from "@/pages/OfferPage"
import PublicitesPage from "@/pages/PublicitesPage"
import AccesPage from "@/pages/AccesPage"
import NodoKnowledgePage from "@/pages/NodoKnowledgePage"
import AdCampaignDetailPage from "@/pages/AdCampaignDetailPage"
import ResidencesLayout from "@/pages/ResidencesLayout"
import ResidenceRequestDetailPage from "@/pages/ResidenceRequestDetailPage"
import ContentsLayout from "@/pages/ContentsLayout"

// Ancienne page Facturation : devenue l'onglet Abonnement de la page Agence.
// Les retours Stripe (Checkout, portail) arrivent encore ici, avec ?checkout=.
function BillingRedirect() {
  const [searchParams] = useSearchParams()
  const next = new URLSearchParams(searchParams)
  next.set("onglet", "abonnement")
  return <Navigate to={`/agences?${next}`} replace />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/partage/:token" element={<SharedInterventionPage />} />
      <Route path="/offre/:token" element={<OfferPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="sinistres" element={<SinistresPage />}>
          <Route index element={<Navigate to="kanban" replace />} />
          <Route path="kanban" element={<SinistresKanbanPage />} />
          <Route path="liste" element={<SinistresListPage />} />
        </Route>
        <Route path="sinistres/:residenceId/:postId" element={<SinistreDetailPage />} />
        <Route path="evenements" element={<EvenementsPage />}>
          <Route index element={<Navigate to="calendrier" replace />} />
          <Route path="liste" element={<EvenementsListPage />} />
          <Route path="calendrier" element={<EvenementsCalendarPage />} />
        </Route>
        <Route path="evenements/:residenceId/:postId" element={<EvenementDetailPage />} />
        {/* Communication : fil d'actualité (posts) et messages par le chat. */}
        <Route path="communications" element={<Navigate to="/communications/fil" replace />} />
        {/* Une seule page pour fil et chat (comme nodo/connaissances/:vue) :
            l'en-tête reste en place à la bascule. Chat réservé au superAdmin
            (contrôlé dans la page). */}
        <Route path="communications/:vue" element={<CommunicationsPage />} />
        <Route path="communications/:residenceId/:postId" element={<CommunicationDetailPage />} />
        {/* Vues affichées par ResidencesLayout (KeepAliveViews) ; Demandes
            réservée au superAdmin (contrôlé dans le layout). */}
        <Route path="residences" element={<ResidencesLayout />}>
          <Route index element={null} />
          <Route path="demandes" element={null} />
        </Route>
        <Route
          path="residences/demandes/:id"
          element={
            <RequireSuperAdmin>
              <ResidenceRequestDetailPage />
            </RequireSuperAdmin>
          }
        />
        <Route path="residences/:id" element={<ResidenceDetailPage />} />
        <Route path="residences/:id/lots/:lotId" element={<LotDetailPage />} />
        <Route path="residences/:id/votes/:voteId" element={<VoteDetailPage />} />
        {/* Sections à onglets : la page parente garde l'en-tête et affiche
            elle-même la vue (KeepAliveViews) ; les sous-routes ne servent
            qu'à reconnaître l'adresse. Retraits et Unificateur réservés au
            superAdmin (contrôlé dans UsersLayout). */}
        <Route path="residents" element={<UsersLayout />}>
          <Route index element={null} />
          <Route path="retraits" element={null} />
          <Route path="unificateur" element={null} />
        </Route>
        <Route path="residents/:uid" element={<ResidentDetailPage />} />
        <Route
          path="contenus"
          element={
            <RequireSuperAdmin>
              <ContentsLayout />
            </RequireSuperAdmin>
          }
        >
          <Route index element={null} />
          <Route path="posts" element={null} />
          <Route path="moderation" element={null} />
        </Route>
        <Route path="agences" element={<AgencesPage />} />
        <Route
          path="agences/:id"
          element={
            <RequireSuperAdmin>
              <AgenceDetailPage />
            </RequireSuperAdmin>
          }
        />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="contacts/:id" element={<ContactDetailPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="profil" element={<ProfilePage />} />
        <Route path="facturation" element={<BillingRedirect />} />
        <Route
          path="publicites"
          element={
            <RequireSuperAdmin>
              <PublicitesPage />
            </RequireSuperAdmin>
          }
        />
        <Route
          path="acces"
          element={
            <RequireSuperAdmin>
              <AccesPage />
            </RequireSuperAdmin>
          }
        />
        {/* Base Nodo : une page, trois vues (Sources / Propositions / Sites web
            autorisés) atteintes directement depuis le sous-menu, comme Sinistres. */}
        <Route path="nodo/connaissances" element={<Navigate to="sources" replace />} />
        <Route
          path="nodo/connaissances/:vue"
          element={
            <RequireSuperAdmin>
              <NodoKnowledgePage />
            </RequireSuperAdmin>
          }
        />
        <Route path="demandes-residences" element={<Navigate to="/residences/demandes" replace />} />
        <Route
          path="publicites/:id"
          element={
            <RequireSuperAdmin>
              <AdCampaignDetailPage />
            </RequireSuperAdmin>
          }
        />
      </Route>
    </Routes>
  )
}

export default App
