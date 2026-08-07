import { useEffect, useState } from "react"
import { Loader2, Pencil, Plus, Settings2, XCircle, RotateCcw, Trash2 } from "lucide-react"
import { toast } from "sonner"

import type { SystemPrompt, RubricDraft } from "@/api/types"
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
import { CalibrateRubricModal } from "./CalibrateRubricModal"
import { rubricDraftsApi } from "@/api"

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
  isEvaluationPrompt?: boolean
}

export function PromptVersionsTab({
  projectId,
  api,
  title,
  description,
  placeholder,
  isEvaluationPrompt,
}: Props) {
  const [items, setItems] = useState<SystemPrompt[] | null>(null)
  const [drafts, setDrafts] = useState<RubricDraft[] | null>(null)
  const [error, setError] = useState(false)
  
  const [open, setOpen] = useState(false)
  const [calibrateModalOpen, setCalibrateModalOpen] = useState(false)
  const [editing, setEditing] = useState<SystemPrompt | null>(null)
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setError(false)
    try {
      const data = await api.list(projectId)
      setItems(data)
      
      if (isEvaluationPrompt) {
        const draftsData = await rubricDraftsApi.list(projectId)
        setDrafts(draftsData)
      }
    } catch (err) {
      setError(true)
      toast.error(err instanceof Error ? err.message : "Failed to load")
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Polling for drafts
  useEffect(() => {
    if (!isEvaluationPrompt) return
    const hasActiveDrafts = drafts?.some(d => d.status === "pending" || d.status === "running")
    if (!hasActiveDrafts) return
    
    const interval = setInterval(async () => {
      try {
        const draftsData = await rubricDraftsApi.list(projectId)
        setDrafts(draftsData)
      } catch (err) {
        // Silently fail on poll
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [isEvaluationPrompt, drafts, projectId])

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

  const handleRetryDraft = async (draftId: string) => {
    try {
      await rubricDraftsApi.retry(projectId, draftId)
      toast.success("Calibration retried")
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to retry calibration")
    }
  }

  const handleReviewDraft = (draft: RubricDraft) => {
    setEditing(null)
    setContent(draft.draft_content || "")
    setOpen(true)
  }

  const handleRemoveDraft = async (draftId: string) => {
    if (!confirm("Are you sure you want to delete this draft?")) return
    try {
      await rubricDraftsApi.remove(projectId, draftId)
      toast.success("Draft deleted")
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete draft")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-medium">{title}</h3>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {isEvaluationPrompt && items !== null && (
            <Button variant="outline" size="sm" onClick={() => setCalibrateModalOpen(true)} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200">
              <Settings2 className="size-4 text-indigo-500" />
              Calibrate Rubric
            </Button>
          )}
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
      </div>

      <CalibrateRubricModal
        open={calibrateModalOpen}
        onOpenChange={setCalibrateModalOpen}
        projectId={projectId}
        prompts={items || []}
        onSuccess={load}
      />

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

      {items !== null && items.length === 0 && (!drafts || drafts.length === 0) && !error && (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            No versions yet.
          </CardContent>
        </Card>
      )}

      {items !== null && (
        <div className="flex flex-col gap-3">
          {isEvaluationPrompt && drafts?.map((draft) => (
            <Card key={draft.id} className="border-indigo-200 bg-indigo-50/50 dark:border-indigo-900/50 dark:bg-indigo-950/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm text-indigo-900 dark:text-indigo-300">
                    <Settings2 className="size-4" />
                    Calibration Draft
                    {draft.status === "completed" && <Badge className="bg-emerald-500 hover:bg-emerald-600">Ready</Badge>}
                    {draft.status === "failed" && <Badge variant="destructive">Failed</Badge>}
                    {draft.status === "pending" && <Badge variant="secondary" className="text-muted-foreground">Pending</Badge>}
                    {draft.status === "running" && <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 animate-pulse">Calibrating</Badge>}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs" title={formatDateTime(draft.created_at)}>
                      {formatRelativeTime(draft.created_at)}
                    </span>
                    {draft.status === "failed" && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:bg-destructive/10" onClick={() => handleRetryDraft(draft.id)}>
                        <RotateCcw className="size-3 mr-1" /> Recalibrate
                      </Button>
                    )}
                    {draft.status === "completed" && (
                      <Button variant="outline" size="sm" className="h-7 text-xs bg-background" onClick={() => handleReviewDraft(draft)}>
                        Review & Save
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveDraft(draft.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {draft.status === "failed" && (
                  <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded">
                    <XCircle className="size-4" />
                    <span>{draft.failure_reason}</span>
                  </div>
                )}
                {(draft.status === "pending" || draft.status === "running") && (
                  <div className="flex items-center gap-2 text-xs text-indigo-600 p-2">
                    <Loader2 className="size-4 animate-spin" />
                    <span>Analyzing training data and generating optimized evaluation prompt...</span>
                  </div>
                )}
                {draft.status === "completed" && draft.draft_content && (
                  <pre className="bg-background max-h-48 overflow-auto whitespace-pre-wrap rounded-md p-3 font-mono text-xs leading-relaxed border border-indigo-200 dark:border-indigo-900/50 text-foreground">
                    {truncate(draft.draft_content, 240)}
                  </pre>
                )}
              </CardContent>
            </Card>
          ))}
          
          {items.map((item, idx) => (
            <Card key={item.id} className={idx === 0 && (!drafts || drafts.length === 0) ? "border-primary/30" : ""}>
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
