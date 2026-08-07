import { Navigate, useLocation } from "react-router-dom"

import { useAuth } from "@/context/auth-context"

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, auth } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  // Redirect to /workspace selector if no active tenant session is set
  if (!auth?.tenantId && location.pathname !== "/workspace") {
    return <Navigate to="/workspace" replace />
  }

  return <>{children}</>
}
