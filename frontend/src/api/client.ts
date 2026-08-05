import type { HeadersMap } from "./types"
import { logger } from "@/lib/logger"
import { toast } from "sonner"

const STORAGE_KEYS = {
  tenantId: "llm_eval.tenant_id",
  userId: "llm_eval.user_id",
  email: "llm_eval.email",
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
  tenantId: string
  userId: string
  email: string
} | null {
  const tenantId = localStorage.getItem(STORAGE_KEYS.tenantId)
  const userId = localStorage.getItem(STORAGE_KEYS.userId)
  if (!tenantId || !userId) return null
  return {
    tenantId,
    userId,
    email: localStorage.getItem(STORAGE_KEYS.email) ?? "",
  }
}

export function setStoredAuth(auth: {
  tenantId: string
  userId: string
  email: string
}): void {
  localStorage.setItem(STORAGE_KEYS.tenantId, auth.tenantId)
  localStorage.setItem(STORAGE_KEYS.userId, auth.userId)
  localStorage.setItem(STORAGE_KEYS.email, auth.email)
  window.dispatchEvent(new Event("auth:change"))
}

export function clearStoredAuth(): void {
  localStorage.removeItem(STORAGE_KEYS.tenantId)
  localStorage.removeItem(STORAGE_KEYS.userId)
  localStorage.removeItem(STORAGE_KEYS.email)
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
