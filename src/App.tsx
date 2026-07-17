import { Routes, Route, Navigate } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import LoginPage from "@/pages/LoginPage"
import RegisterPage from "@/pages/RegisterPage"
import DashboardPage from "@/pages/DashboardPage"
import ResidencesPage from "@/pages/ResidencesPage"
import ResidenceDetailPage from "@/pages/ResidenceDetailPage"
import ResidentsPage from "@/pages/ResidentsPage"
import ResidentDetailPage from "@/pages/ResidentDetailPage"
import SinistresPage from "@/pages/SinistresPage"
import SinistresKanbanPage from "@/pages/SinistresKanbanPage"
import SinistresListPage from "@/pages/SinistresListPage"
import SinistreDetailPage from "@/pages/SinistreDetailPage"
import EvenementsPage from "@/pages/EvenementsPage"
import EvenementsListPage from "@/pages/EvenementsListPage"
import EvenementsCalendarPage from "@/pages/EvenementsCalendarPage"
import EvenementDetailPage from "@/pages/EvenementDetailPage"
import AgencesPage from "@/pages/AgencesPage"
import ContactsPage from "@/pages/ContactsPage"
import ContactDetailPage from "@/pages/ContactDetailPage"

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
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
          <Route index element={<Navigate to="liste" replace />} />
          <Route path="liste" element={<EvenementsListPage />} />
          <Route path="calendrier" element={<EvenementsCalendarPage />} />
        </Route>
        <Route path="evenements/:residenceId/:postId" element={<EvenementDetailPage />} />
        <Route path="residences" element={<ResidencesPage />} />
        <Route path="residences/:id" element={<ResidenceDetailPage />} />
        <Route path="residents" element={<ResidentsPage />} />
        <Route path="residents/:uid" element={<ResidentDetailPage />} />
        <Route path="agences" element={<AgencesPage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="contacts/:id" element={<ContactDetailPage />} />
      </Route>
    </Routes>
  )
}

export default App
