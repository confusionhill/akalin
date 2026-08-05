import { useEffect, useState, type ReactNode } from "react"

import { authApi } from "@/api"
import { clearStoredAuth, getStoredAuth, setStoredAuth } from "@/api/client"
import { AuthContext, type AuthState } from "@/context/auth-context"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(() => getStoredAuth())

  useEffect(() => {
    const handler = () => setAuth(getStoredAuth())
    window.addEventListener("auth:change", handler)
    return () => window.removeEventListener("auth:change", handler)
  }, [])

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password)
    setStoredAuth({
      tenantId: res.tenant_id,
      userId: res.id,
      email: res.email,
    })
  }

  const register = async (
    tenantName: string,
    email: string,
    password: string,
  ) => {
    await authApi.register(tenantName, email, password)
    await login(email, password)
  }

  const logout = () => clearStoredAuth()

  return (
    <AuthContext.Provider
      value={{
        auth,
        isAuthenticated: auth !== null,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
