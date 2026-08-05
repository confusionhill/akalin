import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { Toaster } from "@/components/ui/sonner"
import { AppLayout } from "@/components/layout/AppLayout"
import { RequireAuth } from "@/components/RequireAuth"
import { AuthProvider } from "@/context/AuthContext"
import { LoginPage } from "@/pages/Login"
import { RegisterPage } from "@/pages/Register"
import { ProjectsPage } from "@/pages/Projects"
import { ProvidersPage } from "@/pages/Providers"
import { ToolsPage } from "@/pages/Tools"
import { ProjectDetailPage } from "@/pages/project/ProjectDetail"
import { EvaluationDetailPage } from "@/pages/project/EvaluationDetail"
import { SettingsPage } from "@/pages/Settings"

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/providers" element={<ProvidersPage />} />
            <Route path="/tools" element={<ToolsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route
              path="/projects/:id/evaluations/:runId"
              element={<EvaluationDetailPage />}
            />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </AuthProvider>
  )
}
