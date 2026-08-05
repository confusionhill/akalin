import { useEffect, useState } from "react"
import { Loader2, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"

import type { SystemPrompt } from "@/api/types"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { formatDateTime, formatRelativeTime, truncate } from "@/lib/utils"

interface PromptApi {
  list: (projectId: string) => Promise<SystemPrompt[]>
  create: (
    projectId: string,
    body: { content: string },
  ) => Promise<SystemPrompt>
  update: (
    projectId: string,
    promptId: string,
    body: { content: string },
  ) => Promise<SystemPrompt>
}

interface Props {
  projectId: string
  api: PromptApi
  title: string
  description: string
  placeholder: string
}

export function PromptVersionsTab({
  projectId,
  api,
  title,
  description,
  placeholder,
}: Props) {
  const [items, setItems] = useState<SystemPrompt[] | null>(null)
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SystemPrompt | null>(null)
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setError(false)
    try {
      setItems(null)
      const data = await api.list(projectId)
      setItems(data)
    } catch (err) {
      setError(true)
      toast.error(err instanceof Error ? err.message : "Failed to load")
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const openCreate = () => {
    setEditing(null)
    setContent("")
    setOpen(true)
  }

  const openEdit = (item: SystemPrompt) => {
    setEditing(item)
    setContent(item.content)
    setOpen(true)
  }

  const handleSave = async () => {
    if (!content.trim()) return
    setSaving(true)
    try {
      if (editing) {
        await api.update(projectId, editing.id, { content: content.trim() })
        toast.success(`Version ${editing.version} updated`)
      } else {
        await api.create(projectId, { content: content.trim() })
        toast.success("New version saved")
      }
      setOpen(false)
      setContent("")
      setEditing(null)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{title}</h3>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              New version
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editing
                  ? `Edit version ${editing.version}`
                  : `${title} — new version`}
              </DialogTitle>
              <DialogDescription>
                {editing
                  ? "Changes overwrite this version's content in place."
                  : "Saving creates a new versioned revision."}
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={placeholder}
              className="min-h-48 font-mono text-sm"
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || !content.trim()}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                {editing ? "Save changes" : "Save version"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {items === null && !error && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="flex items-center justify-between py-6">
            <p className="text-muted-foreground text-sm">Failed to load.</p>
            <Button variant="outline" size="sm" onClick={load}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {items !== null && items.length === 0 && !error && (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            No versions yet.
          </CardContent>
        </Card>
      )}

      {items !== null && items.length > 0 && (
        <div className="flex flex-col gap-3">
          {items.map((item, idx) => (
            <Card key={item.id} className={idx === 0 ? "border-primary/30" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    Version {item.version}
                    {idx === 0 && <Badge variant="default">latest</Badge>}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(item)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <span
                      className="text-muted-foreground ml-1 text-xs"
                      title={formatDateTime(item.created_at)}
                    >
                      {formatRelativeTime(item.created_at)}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted/50 max-h-48 overflow-auto whitespace-pre-wrap rounded-md p-3 font-mono text-xs leading-relaxed">
                  {idx === 0 ? item.content : truncate(item.content, 240)}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
