import type { HeadersMap } from "./types"
import { logger } from "@/lib/logger"
import { toast } from "sonner"

const STORAGE_KEYS = {
  tenantId: "llm_eval.tenant_id",
  userId: "llm_eval.user_id",
  email: "llm_eval.email",
  handle: "llm_eval.handle",
  fullName: "llm_eval.full_name",
} as const

const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api"

export class ApiError extends Error {
  status: number
  details: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.details = details
  }
}

export function getStoredAuth(): {
  tenantId?: string
  userId: string
  email: string
  handle: string
  fullName: string
} | null {
  const userId = localStorage.getItem(STORAGE_KEYS.userId)
  if (!userId) return null
  const tenantId = localStorage.getItem(STORAGE_KEYS.tenantId)
  return {
    tenantId: tenantId && tenantId !== "undefined" ? tenantId : undefined,
    userId,
    email: localStorage.getItem(STORAGE_KEYS.email) ?? "",
    handle: localStorage.getItem(STORAGE_KEYS.handle) ?? "",
    fullName: localStorage.getItem(STORAGE_KEYS.fullName) ?? "",
  }
}

export function setStoredAuth(auth: {
  tenantId?: string
  userId: string
  email: string
  handle: string
  fullName: string
}): void {
  if (auth.tenantId && auth.tenantId !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.tenantId, auth.tenantId)
  } else {
    localStorage.removeItem(STORAGE_KEYS.tenantId)
  }
  localStorage.setItem(STORAGE_KEYS.userId, auth.userId)
  localStorage.setItem(STORAGE_KEYS.email, auth.email)
  localStorage.setItem(STORAGE_KEYS.handle, auth.handle)
  localStorage.setItem(STORAGE_KEYS.fullName, auth.fullName)
  window.dispatchEvent(new Event("auth:change"))
}

export function clearStoredAuth(): void {
  localStorage.removeItem(STORAGE_KEYS.tenantId)
  localStorage.removeItem(STORAGE_KEYS.userId)
  localStorage.removeItem(STORAGE_KEYS.email)
  localStorage.removeItem(STORAGE_KEYS.handle)
  localStorage.removeItem(STORAGE_KEYS.fullName)
  window.dispatchEvent(new Event("auth:change"))
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  }
  const token = localStorage.getItem("llm_eval.token")
  const auth = getStoredAuth()
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  if (auth) {
    headers["X-Tenant-ID"] = auth.tenantId
    headers["X-User-ID"] = auth.userId
  }
  return headers
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${BASE_URL}${path}`
  logger.info(`${method} ${path}`, body)
  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (err) {
    logger.error(`${method} ${path} network error`, err)
    throw new ApiError(
      err instanceof Error ? err.message : "Network request failed",
      0,
    )
  }

  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    const payload = data as { message?: string } | null
    const message =
      (payload && typeof payload === "object" && payload.message) ||
      (typeof data === "string" && data) ||
          res.statusText ||
          `Request failed with status ${res.status}`
    logger.error(`${method} ${path} -> ${res.status}`, { message, data })
    if (res.status === 401) {
      localStorage.removeItem("llm_eval.token")
      clearStoredAuth()
      toast.error("Session expired. Please login again.")
    }
    throw new ApiError(message, res.status, data)
  }

  logger.info(`${method} ${path} -> ${res.status}`)
  return data as T
}

export const http = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
  postForm: async <T>(path: string, body: FormData): Promise<T> => {
    const url = `${BASE_URL}${path}`
    logger.info(`POST ${path} (FormData)`)
    
    // We don't set Content-Type so fetch can set the correct multipart boundary
    const headers = authHeaders()
    delete headers["Content-Type"]

    let res: Response
    try {
      res = await fetch(url, {
        method: "POST",
        headers,
        body,
      })
    } catch (err) {
      logger.error(`POST ${path} network error`, err)
      throw new ApiError(
        err instanceof Error ? err.message : "Network request failed",
        0,
      )
    }

    const text = await res.text()
    let data: unknown = null
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = text
      }
    }

    if (!res.ok) {
      const payload = data as { message?: string } | null
      const message =
        (payload && typeof payload === "object" && payload.message) ||
        (typeof data === "string" && data) ||
            res.statusText ||
            `Request failed with status ${res.status}`
      logger.error(`POST ${path} -> ${res.status}`, { message, data })
      if (res.status === 401) {
        localStorage.removeItem("llm_eval.token")
        clearStoredAuth()
        toast.error("Session expired. Please login again.")
      }
      throw new ApiError(message, res.status, data)
    }

    logger.info(`POST ${path} -> ${res.status}`)
    return data as T
  },
}

export function parseHeaders(value: string): HeadersMap {
  if (!value) return {}
  const map: HeadersMap = {}
  for (const line of value.split("\n")) {
    const idx = line.indexOf(":")
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const val = line.slice(idx + 1).trim()
    if (key) map[key] = val
  }
  return map
}

export function stringifyHeaders(headers: HeadersMap): string {
  return Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")
}
