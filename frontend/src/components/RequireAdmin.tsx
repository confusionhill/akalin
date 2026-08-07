import { Navigate, useLocation } from "react-router-dom"

import { useAuth } from "@/context/auth-context"

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth()
  const location = useLocation()

  const isAdmin = (auth?.accessRole ?? 0) >= 60

  if (!isAdmin) {
    return <Navigate to="/projects" state={{ from: location.pathname }} replace />
  }

  return <>{children}</>
}
