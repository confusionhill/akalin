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
      tenantId: undefined,
      email: res.email,
      handle: res.handle,
      fullName: res.full_name,
    })
  }

  const register = async (
    email: string,
    handle: string,
    fullName: string,
    password: string,
  ) => {
    const res = await authApi.register(email, handle, fullName, password)
    localStorage.setItem("llm_eval.token", res.token)
    setStoredAuth({
      userId: res.id,
      tenantId: undefined,
      email: res.email,
      handle: res.handle,
      fullName: res.full_name,
    })
  }

  const switchTenant = async (tenantId: string) => {
    const res = await authApi.switchTenant(tenantId)
    localStorage.setItem("llm_eval.token", res.token)
    if (auth) {
      const updated = {
        ...auth,
        tenantId: res.tenant_id,
        accessRole: res.access_role,
      }
      setAuth(updated)
      setStoredAuth(updated)
    }
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
        switchTenant,
        updateAuth,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
