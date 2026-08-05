type LogLevel = "info" | "warn" | "error"

const PREFIX = "[llm-eval]"

function log(level: LogLevel, message: string, details?: unknown) {
  const ts = new Date().toISOString()
  const fn =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.log
  if (details !== undefined) {
    fn(`${PREFIX} ${ts} ${message}`, details)
  } else {
    fn(`${PREFIX} ${ts} ${message}`)
  }
}

export const logger = {
  info: (m: string, d?: unknown) => log("info", m, d),
  warn: (m: string, d?: unknown) => log("warn", m, d),
  error: (m: string, d?: unknown) => log("error", m, d),
}
