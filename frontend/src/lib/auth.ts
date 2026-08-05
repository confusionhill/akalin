import { clearStoredAuth } from "@/api/client"

export const useAuthToken = () => {
  const token = localStorage.getItem("llm_eval.token")

  const setToken = (token: string) => {
    localStorage.setItem("llm_eval.token", token)
    window.dispatchEvent(new Event("auth:change"))
  }

  const clearToken = () => {
    localStorage.removeItem("llm_eval.token")
    clearStoredAuth()
    window.dispatchEvent(new Event("auth:change"))
  }

  const isTokenExpired = (): boolean => {
    if (!token) return true

    try {
      const payload = JSON.parse(atob(token.split(".")[1]))
      const expirationTime = payload.exp * 1000
      return Date.now() >= expirationTime
    } catch {
      return true
    }
  }

  const refreshToken = async (): Promise<boolean> => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || "/api"}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      })

      if (response.ok) {
        const data = await response.json()
        setToken(data.token)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  return {
    token,
    setToken,
    clearToken,
    isAuthenticated: !!token && !isTokenExpired(),
    isTokenExpired,
    refreshToken,
  }
}