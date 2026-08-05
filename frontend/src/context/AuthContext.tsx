import { useEffect, useState, type ReactNode } from "react"

import { authApi } from "@/api"
import { getStoredAuth, setStoredAuth, clearStoredAuth } from "@/api/client"
import { useAuthToken } from "@/lib/auth"
import { AuthContext, type AuthState } from "@/context/auth-context"

export function AuthProvider({ children }: { children: ReactNode }) {
  const { clearToken } = useAuthToken()
  const [auth, setAuth] = useState<AuthState | null>(() => getStoredAuth())

  useEffect(() => {
    const handler = () => setAuth(getStoredAuth())
    window.addEventListener("auth:change", handler)
    return () => window.removeEventListener("auth:change", handler)
  }, [])

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password)
    localStorage.setItem("llm_eval.token", res.token)
    setStoredAuth({
      userId: res.id,
      tenantId: res.tenant_id,
      email: res.email,
      handle: res.handle,
      fullName: res.full_name,
    })
  }

  const register = async (
    tenantName: string,
    email: string,
    handle: string,
    fullName: string,
    password: string,
  ) => {
    const res = await authApi.register(tenantName, email, handle, fullName, password)
    localStorage.setItem("llm_eval.token", res.token)
    setStoredAuth({
      userId: res.id,
      tenantId: res.tenant_id,
      email: res.email,
      handle: res.handle,
      fullName: res.full_name,
    })
  }

  const updateAuth = (updates: Partial<AuthState>) => {
    if (!auth) return
    const newAuth = { ...auth, ...updates }
    setAuth(newAuth)
    setStoredAuth(newAuth)
  }

  const logout = () => {
    localStorage.removeItem("llm_eval.token")
    clearToken()
    clearStoredAuth()
  }

  return (
    <AuthContext.Provider
      value={{
        auth,
        isAuthenticated: auth !== null,
        login,
        register,
        updateAuth,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
