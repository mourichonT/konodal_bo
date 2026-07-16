import { Routes, Route } from "react-router-dom"
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
import AgencesPage from "@/pages/AgencesPage"

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
        <Route path="sinistres" element={<SinistresPage />} />
        <Route path="residences" element={<ResidencesPage />} />
        <Route path="residences/:id" element={<ResidenceDetailPage />} />
        <Route path="residents" element={<ResidentsPage />} />
        <Route path="residents/:uid" element={<ResidentDetailPage />} />
        <Route path="agences" element={<AgencesPage />} />
      </Route>
    </Routes>
  )
}

export default App
