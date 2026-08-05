import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date
  const now = Date.now()
  const diff = Math.round((d.getTime() - now) / 1000)
  const abs = Math.abs(diff)
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
  const divisions: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
    { amount: 60, unit: "second" },
    { amount: 60, unit: "minute" },
    { amount: 24, unit: "hour" },
    { amount: 7, unit: "day" },
    { amount: 4.34524, unit: "week" },
    { amount: 12, unit: "month" },
    { amount: Number.POSITIVE_INFINITY, unit: "year" },
  ]
  let duration = abs
  let unit: Intl.RelativeTimeFormatUnit = "second"
  for (const division of divisions) {
    if (duration < division.amount) {
      unit = division.unit
      break
    }
    duration /= division.amount
    unit = division.unit
  }
  return rtf.format(Math.sign(diff) * -Math.round(duration), unit)
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function truncate(text: string, max = 80): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + "…"
}
