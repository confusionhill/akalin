import { createContext, useContext } from "react"

export interface AuthState {
  userId: string
  tenantId?: string
  email: string
  handle: string
  fullName: string
  accessRole?: number
}

export interface AuthContextValue {
  auth: AuthState | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (
    email: string,
    handle: string,
    fullName: string,
    password: string,
  ) => Promise<void>
  switchTenant: (tenantId: string) => Promise<void>
  updateAuth: (updates: Partial<AuthState>) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}
