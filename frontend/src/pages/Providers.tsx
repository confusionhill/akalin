import { useEffect, useState } from "react"
import { Eye, EyeOff, ExternalLink, KeyRound, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { providersApi } from "@/api"
import type { HeadersMap, ProviderConfig } from "@/api/types"
import { findPresetByBaseUrl, providerPresets } from "@/lib/providers"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { formatRelativeTime } from "@/lib/utils"

interface HeaderRow {
  id: number
  key: string
  value: string
}

interface FormState {
  presetId: string
  name: string
  base_url: string
  api_key: string
  headers: HeaderRow[]
}

let headerIdSeq = 1
const nextHeaderId = () => headerIdSeq++

const empty: FormState = {
  presetId: "custom",
  name: "",
  base_url: "",
  api_key: "",
  headers: [],
}

function headersToRows(h: HeadersMap | null | undefined): HeaderRow[] {
  if (!h) return []
  return Object.entries(h).map(([key, value]) => ({
    id: nextHeaderId(),
    key,
    value,
  }))
}

function rowsToHeaders(rows: HeaderRow[]): HeadersMap {
  const out: HeadersMap = {}
  for (const r of rows) {
    const k = r.key.trim()
    if (k) out[k] = r.value
  }
  return out
}

export function ProvidersPage() {
  const [items, setItems] = useState<ProviderConfig[] | null>(null)
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ProviderConfig | null>(null)
  const [form, setForm] = useState<FormState>(empty)
  const [saving, setSaving] = useState(false)
  const [showKey, setShowKey] = useState(false)

  const load = async () => {
    setError(false)
    try {
      setItems(null)
      const data = await providersApi.list()
      setItems(data)
    } catch (err) {
      setError(true)
      toast.error(err instanceof Error ? err.message : "Failed to load")
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(empty)
    setShowKey(false)
    setOpen(true)
  }

  const openEdit = (p: ProviderConfig) => {
    const preset = findPresetByBaseUrl(p.base_url)
    setEditing(p)
    setForm({
      presetId: preset?.id ?? "custom",
      name: p.name,
      base_url: p.base_url,
      api_key: p.api_key ?? "",
      headers: headersToRows(p.custom_headers),
    })
    setShowKey(false)
    setOpen(true)
  }

  const handlePresetChange = (presetId: string) => {
    const preset = providerPresets.find((p) => p.id === presetId)
    if (!preset) return
    setForm((f) => ({
      ...f,
      presetId,
      base_url: preset.baseUrl,
      name: f.name || preset.label,
    }))
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.base_url.trim()) return
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        base_url: form.base_url.trim(),
        api_key: form.api_key.trim(),
        custom_headers: rowsToHeaders(form.headers),
      }
      if (editing) {
        await providersApi.update(editing.id, body)
        toast.success("Provider updated")
      } else {
        await providersApi.create(body)
        toast.success("Provider created")
      }
      setOpen(false)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (p: ProviderConfig) => {
    try {
      await providersApi.remove(p.id)
      toast.success("Provider deleted")
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  const selectedPreset =
    providerPresets.find((p) => p.id === form.presetId) ?? null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Providers</h1>
          <p className="text-muted-foreground text-sm">
            Global BYOK providers, shared across all projects.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Add provider
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit provider" : "New provider"}
            </DialogTitle>
            <DialogDescription>
              Pick a preset or use a custom OpenAI-compatible endpoint.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="prov-preset">Provider</Label>
              <Select
                value={form.presetId}
                onValueChange={handlePresetChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent>
                  {providerPresets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPreset?.docsUrl && (
                <a
                  href={selectedPreset.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground inline-flex items-center gap-1 text-xs hover:underline"
                >
                  Model docs <ExternalLink className="size-3" />
                </a>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="prov-name">Name</Label>
                <Input
                  id="prov-name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="My OpenAI key"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="prov-url">Base URL</Label>
                <Input
                  id="prov-url"
                  value={form.base_url}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, base_url: e.target.value }))
                  }
                  placeholder="https://api.openai.com/v1"
                  disabled={form.presetId !== "custom"}
                />
              </div>
            </div>

            {form.presetId !== "ollama" &&
              form.presetId !== "lmstudio" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="prov-key">API key</Label>
                  <div className="relative">
                    <Input
                      id="prov-key"
                      type={showKey ? "text" : "password"}
                      value={form.api_key}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, api_key: e.target.value }))
                      }
                      placeholder="sk-... (stored as plain text)"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-0 right-0 h-9 w-9"
                      onClick={() => setShowKey((s) => !s)}
                      aria-label={showKey ? "Hide API key" : "Show API key"}
                      tabIndex={-1}
                    >
                      {showKey ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

            <div className="flex flex-col gap-2">
              <Label>Custom headers</Label>
              <div className="flex flex-col gap-2">
                {form.headers.length === 0 && (
                  <p className="text-muted-foreground text-xs">
                    No custom headers. Tap "Add header" to add one.
                  </p>
                )}
                {form.headers.map((row) => (
                  <div key={row.id} className="flex flex-wrap items-center gap-2">
                    <Input
                      value={row.key}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          headers: f.headers.map((r) =>
                            r.id === row.id ? { ...r, key: e.target.value } : r,
                          ),
                        }))
                      }
                      placeholder="Header name (e.g. X-Org-Id)"
                      className="min-w-0 flex-1 font-mono text-xs"
                    />
                    <Input
                      value={row.value}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          headers: f.headers.map((r) =>
                            r.id === row.id
                              ? { ...r, value: e.target.value }
                              : r,
                          ),
                        }))
                      }
                      placeholder="value"
                      className="min-w-0 flex-1 font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          headers: f.headers.filter((r) => r.id !== row.id),
                        }))
                      }
                      aria-label="Delete header"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      headers: [
                        ...f.headers,
                        { id: nextHeaderId(), key: "", value: "" },
                      ],
                    }))
                  }
                >
                  <Plus className="size-4" />
                  Add header
                </Button>
              </div>
            </div>

            {selectedPreset && selectedPreset.models.length > 0 && (
              <div className="bg-muted/50 flex flex-wrap gap-1.5 rounded-md p-3">
                <span className="text-muted-foreground text-xs">
                  Suggested models:
                </span>
                {selectedPreset.models.map((m) => (
                  <Badge key={m} variant="outline" className="font-mono text-[10px]">
                    {m}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.base_url.trim()}
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {items === null && !error && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="flex items-center justify-between py-6">
            <p className="text-muted-foreground text-sm">
              Could not load providers. Is the backend running on :8080?
            </p>
            <Button variant="outline" size="sm" onClick={load}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {items !== null && items.length === 0 && !error && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="bg-muted flex size-12 items-center justify-center rounded-full">
              <KeyRound className="text-muted-foreground size-5" />
            </div>
            <div>
              <p className="font-medium">No providers yet</p>
              <p className="text-muted-foreground text-sm">
                Add a provider to start running evaluations.
              </p>
            </div>
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Add provider
            </Button>
          </CardContent>
        </Card>
      )}

      {items !== null && items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => {
            const preset = findPresetByBaseUrl(p.base_url)
            return (
              <Card key={p.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <KeyRound className="text-muted-foreground size-4" />
                      {p.name}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(p)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(p)}
                      >
                        <Trash2 className="text-destructive size-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    {preset && (
                      <Badge variant="secondary">{preset.label}</Badge>
                    )}
                    <Badge variant={p.api_key ? "success" : "warning"}>
                      {p.api_key ? "Key set" : "No key"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground truncate font-mono text-xs">
                    {p.base_url}
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    {formatRelativeTime(p.created_at)}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
