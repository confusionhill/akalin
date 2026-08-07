import { useEffect, useState } from "react"
import { Bot, Loader2, Pencil, Play, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { llmModelsApi, providersApi } from "@/api"
import type { LLMModel, ProviderConfig } from "@/api/types"
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

interface FormState {
  provider_id: string
  title: string
  model: string
}

const empty: FormState = {
  provider_id: "",
  title: "",
  model: "",
}

export function ModelsPage() {
  const [items, setItems] = useState<LLMModel[] | null>(null)
  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<LLMModel | null>(null)
  const [form, setForm] = useState<FormState>(empty)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const load = async () => {
    setError(false)
    try {
      setItems(null)
      const [models, provs] = await Promise.all([
        llmModelsApi.list(),
        providersApi.list(),
      ])
      setItems(models)
      setProviders(provs)
    } catch (err) {
      setError(true)
      toast.error(err instanceof Error ? err.message : "Failed to load models")
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({
      ...empty,
      provider_id: providers.length > 0 ? providers[0].id : "",
    })
    setOpen(true)
  }

  const openEdit = (m: LLMModel) => {
    setEditing(m)
    setForm({
      provider_id: m.provider_id,
      title: m.title,
      model: m.model,
    })
    setOpen(true)
  }

  const handleTest = async () => {
    if (!form.provider_id || !form.model.trim()) {
      toast.error("Select a provider and enter a model to test")
      return
    }
    setTesting(true)
    try {
      const result = await llmModelsApi.test({
        provider_id: form.provider_id,
        model: form.model.trim(),
      })
      if (result.success) {
        toast.success("Connection successful — model responded")
      } else {
        toast.error(result.error || "Test failed")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed")
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!form.provider_id || !form.title.trim() || !form.model.trim()) return
    setSaving(true)
    try {
      const body = {
        provider_id: form.provider_id,
        title: form.title.trim(),
        model: form.model.trim(),
      }
      if (editing) {
        await llmModelsApi.update(editing.id, body)
        toast.success("Model updated")
      } else {
        await llmModelsApi.create(body)
        toast.success("Model created")
      }
      setOpen(false)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (m: LLMModel) => {
    if (!confirm(`Delete model "${m.title}"?`)) return
    try {
      await llmModelsApi.remove(m.id)
      toast.success("Model deleted")
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  const providerName = (providerId: string) => {
    const p = providers.find((pv) => pv.id === providerId)
    return p?.name ?? "Unknown"
  }

  const canSave = form.provider_id && form.title.trim() && form.model.trim()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Models</h1>
          <p className="text-muted-foreground text-sm">
            Saved LLM models bound to providers, available as dropdowns across
            projects.
          </p>
        </div>
        <Button onClick={openCreate} disabled={providers.length === 0}>
          <Plus className="size-4" />
          Add model
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit model" : "New model"}
            </DialogTitle>
            <DialogDescription>
              Configure an LLM model bound to a provider.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="model-provider">Provider</Label>
              <Select
                value={form.provider_id}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, provider_id: v }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="model-title">Title</Label>
              <Input
                id="model-title"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="GPT-4o Production"
              />
              <p className="text-muted-foreground text-[11px]">
                A friendly label shown in dropdowns.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="model-string">Model</Label>
              <Input
                id="model-string"
                value={form.model}
                onChange={(e) =>
                  setForm((f) => ({ ...f, model: e.target.value }))
                }
                placeholder="gpt-4o"
                className="font-mono text-sm"
              />
              <p className="text-muted-foreground text-[11px]">
                The exact model identifier sent to the API.
              </p>
            </div>
          </div>
          <DialogFooter className="flex-row gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={testing || !form.provider_id || !form.model.trim()}
            >
              {testing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              Test
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !canSave}
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                {editing ? "Save changes" : "Add"}
              </Button>
            </div>
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
              Could not load models. Is the backend running on :8080?
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
              <Bot className="text-muted-foreground size-5" />
            </div>
            <div>
              <p className="font-medium">No models yet</p>
              <p className="text-muted-foreground text-sm">
                {providers.length === 0
                  ? "Add a provider first, then create models."
                  : "Add a model to use as a dropdown in evaluations."}
              </p>
            </div>
            <Button
              onClick={openCreate}
              disabled={providers.length === 0}
            >
              <Plus className="size-4" />
              Add model
            </Button>
          </CardContent>
        </Card>
      )}

      {items !== null && items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((m) => (
            <Card key={m.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Bot className="text-muted-foreground size-4" />
                    {m.title}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(m)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(m)}
                    >
                      <Trash2 className="text-destructive size-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{providerName(m.provider_id)}</Badge>
                </div>
                <p className="text-muted-foreground truncate font-mono text-xs">
                  {m.model}
                </p>
                <p className="text-muted-foreground text-[11px]">
                  {formatRelativeTime(m.created_at)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
