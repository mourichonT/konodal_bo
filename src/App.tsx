import { Routes, Route } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import LoginPage from "@/pages/LoginPage"
import DashboardPage from "@/pages/DashboardPage"
import ResidencesPage from "@/pages/ResidencesPage"
import ResidentsPage from "@/pages/ResidentsPage"
import SinistresPage from "@/pages/SinistresPage"

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
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
        <Route path="residents" element={<ResidentsPage />} />
      </Route>
    </Routes>
  )
}

export default App
