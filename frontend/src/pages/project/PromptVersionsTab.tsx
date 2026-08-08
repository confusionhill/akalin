import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Loader2, Pencil, Plus, Settings2, XCircle, RotateCcw, Trash2, Split, Check, Copy, Code, ChevronRight, ChevronDown } from "lucide-react"
import { toast } from "sonner"

import type { RubricDraft, PublishSystemPromptsInput } from "@/api/types"
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

export interface BasePrompt {
  id: string
  project_id: string
  content: string
  version: number
  created_by: string
  created_at: string
  traffic_weight?: number
}

interface PromptApi {
  list: (projectId: string) => Promise<BasePrompt[]>
  create: (
    projectId: string,
    body: { content: string },
  ) => Promise<BasePrompt>
  update: (
    projectId: string,
    promptId: string,
    body: { content: string },
  ) => Promise<BasePrompt>
  publish?: (projectId: string, body: PublishSystemPromptsInput) => Promise<void>
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
  const [items, setItems] = useState<BasePrompt[] | null>(null)
  const [drafts, setDrafts] = useState<RubricDraft[] | null>(null)
  const [error, setError] = useState(false)
  
  const [open, setOpen] = useState(false)
  const [calibrateModalOpen, setCalibrateModalOpen] = useState(false)
  const [editing, setEditing] = useState<BasePrompt | null>(null)
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)

  // Traffic Splitting Modal State
  const [distributionModalOpen, setDistributionModalOpen] = useState(false)
  const [isEditingDistribution, setIsEditingDistribution] = useState(false)
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([])
  const [weights, setWeights] = useState<Record<string, number>>({})
  const [savingDist, setSavingDist] = useState(false)
  
  const [snippetLanguage, setSnippetLanguage] = useState<"curl" | "python" | "nodejs">("curl")
  const [copiedCode, setCopiedCode] = useState(false)
  const [showSampleResponse, setShowSampleResponse] = useState(false)

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

  const openEdit = (item: BasePrompt) => {
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

  const openDistributionModal = () => {
    if (!items) return
    const initialSelected: string[] = []
    const initialWeights: Record<string, number> = {}
    items.forEach((item) => {
      if (item.traffic_weight && item.traffic_weight > 0) {
        initialSelected.push(item.id)
        initialWeights[item.id] = item.traffic_weight
      }
    })
    setSelectedPrompts(initialSelected)
    setWeights(initialWeights)
    setIsEditingDistribution(false)
    setDistributionModalOpen(true)
  }

  const getApiSnippet = () => {
    const baseUrl = window.location.origin
    const endpoint = `${baseUrl}/api/v1/projects/${projectId}/active-prompt`
    
    if (snippetLanguage === "curl") {
      return `curl -X GET ${endpoint} \\\n  -H "Authorization: Bearer <YOUR_API_KEY>"`
    } else if (snippetLanguage === "python") {
      return `import requests\n\nheaders = {"Authorization": "Bearer <YOUR_API_KEY>"}\nresponse = requests.get(\n  "${endpoint}",\n  headers=headers\n)\nprint(response.json())`
    } else {
      return `const response = await fetch("${endpoint}", {\n  headers: {\n    "Authorization": "Bearer <YOUR_API_KEY>"\n  }\n});\nconst data = await response.json();\nconsole.log(data);`
    }
  }

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(getApiSnippet())
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    } catch (err) {
      toast.error("Failed to copy code")
    }
  }

  const toggleSelection = (id: string) => {
    if (selectedPrompts.includes(id)) {
      // Remove
      const newSelected = selectedPrompts.filter(pid => pid !== id)
      setSelectedPrompts(newSelected)
      
      setWeights(prev => {
        const next = { ...prev }
        delete next[id]
        if (newSelected.length === 1) {
          next[newSelected[0]] = 100
        }
        return next
      })
    } else {
      // Add
      if (selectedPrompts.length >= 2) {
        toast.error("You can only select up to 2 versions for traffic distribution.")
        return
      }
      const newSelected = [...selectedPrompts, id]
      setSelectedPrompts(newSelected)
      
      setWeights(() => {
        if (newSelected.length === 1) {
          return { [id]: 100 }
        } else {
          // split 50/50 automatically
          return {
            [newSelected[0]]: 50,
            [newSelected[1]]: 50,
          }
        }
      })
    }
  }

  const handleUpdateWeight = (id: string, weight: number) => {
    setWeights((prev) => {
      const next = { ...prev, [id]: weight }
      // auto balance if exactly 2 are selected
      if (selectedPrompts.length === 2) {
        const otherId = selectedPrompts.find(pid => pid !== id)!
        next[otherId] = 100 - weight
      }
      return next
    })
  }

  const handleSaveDistribution = async () => {
    if (!api.publish) return
    
    // Validate total weight is exactly 100 or 0
    let total = 0
    const distributions: { prompt_id: string; weight: number }[] = []
    
    for (const [prompt_id, weight] of Object.entries(weights)) {
      if (weight > 0) {
        total += weight
        distributions.push({ prompt_id, weight })
      }
    }

    if (total !== 0 && total !== 100) {
      toast.error(`Total weight must be exactly 100 (current: ${total})`)
      return
    }

    setSavingDist(true)
    try {
      await api.publish(projectId, { distributions })
      toast.success("Traffic distribution updated")
      setDistributionModalOpen(false)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update distribution")
    } finally {
      setSavingDist(false)
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
          {!isEvaluationPrompt && api.publish && items !== null && items.length > 0 && (
            <Button variant="outline" size="sm" onClick={openDistributionModal}>
              <Split className="size-4" />
              {items.some(i => i.traffic_weight && i.traffic_weight > 0) ? "Traffic Distribution" : "Publish"}
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
        prompts={(items as any) || []}
        onSuccess={load}
      />

      <Dialog open={distributionModalOpen} onOpenChange={setDistributionModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Publish & Traffic Distribution</DialogTitle>
            <DialogDescription>
              {isEditingDistribution 
                ? "Select up to 2 versions to publish to production. Adjust traffic weights if you select 2."
                : "View your currently published prompt versions and distribution metrics."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto py-4 pr-2 flex flex-col gap-6">
            {!isEditingDistribution ? (
              // --- VIEW MODE ---
              <div className="space-y-6">
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Currently Published</h4>
                  {items?.filter(i => i.traffic_weight && i.traffic_weight > 0).length === 0 ? (
                    <div className="p-4 border border-dashed rounded-lg text-center text-sm text-muted-foreground bg-muted/30">
                      No versions are currently published.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {items?.filter(i => i.traffic_weight && i.traffic_weight > 0).map(item => (
                        <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                          <div>
                            <div className="text-sm font-medium">Version {item.version}</div>
                            <div className="text-xs text-muted-foreground line-clamp-1">{item.content}</div>
                          </div>
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30">
                            {item.traffic_weight}% Traffic
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex flex-col gap-1">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Code className="size-4" /> API Integration
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Tip: You can generate an API key in <Link to="/settings?tab=api-keys" className="text-primary hover:underline">Settings</Link>.
                    </p>
                  </div>
                  <div className="border rounded-lg overflow-hidden flex flex-col">
                    <div className="flex bg-muted/50 border-b overflow-x-auto">
                      {(["curl", "python", "nodejs"] as const).map(lang => (
                        <button
                          key={lang}
                          onClick={() => setSnippetLanguage(lang)}
                          className={`px-4 py-2 text-xs font-medium capitalize transition-colors ${snippetLanguage === lang ? "bg-background border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                    <div className="p-4 bg-background relative group">
                      <pre className="text-xs font-mono text-muted-foreground overflow-x-auto pb-2">
                        {getApiSnippet()}
                      </pre>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-muted/50"
                        onClick={handleCopyCode}
                      >
                        {copiedCode ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="pt-1">
                    <button 
                      onClick={() => setShowSampleResponse(!showSampleResponse)}
                      className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors mb-2"
                    >
                      {showSampleResponse ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                      Sample Response
                    </button>
                    {showSampleResponse && (
                      <div className="border rounded-lg bg-background p-4 overflow-x-auto">
                        <pre className="text-xs font-mono text-muted-foreground">
{`{
  "id": "c5cd45e0-c456-41ba-b22e-f601e880fb77",
  "project_id": "3683a724-2435-4e99-95dc-6f2e39664763",
  "content": "You are a helpful assistant.",
  "version": 1,
  "traffic_weight": 100,
  "created_by": "00000000-0000-0000-0000-000000000002",
  "created_at": "2026-08-08T15:20:30.333Z"
}`}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // --- EDIT MODE ---
              <div className="flex flex-col gap-3">
                {items?.map((item) => {
                  const isSelected = selectedPrompts.includes(item.id)
                  const currentWeight = weights[item.id] || 0
                  return (
                    <div 
                      key={item.id} 
                      className={`flex flex-col gap-3 p-3 border rounded-lg transition-colors ${isSelected ? "bg-amber-50/50 border-amber-200" : "bg-card hover:bg-accent/50 cursor-pointer"}`}
                      onClick={() => !isSelected && toggleSelection(item.id)}
                    >
                      <div className="flex items-start gap-3">
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleSelection(item.id); }}
                          className={`mt-1 flex size-5 shrink-0 items-center justify-center rounded border ${isSelected ? "bg-amber-500 border-amber-500 text-white" : "border-input bg-background"}`}
                        >
                          {isSelected && <Check className="size-3.5" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium mb-1">
                            Version {item.version}
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-2 font-mono break-all">
                            {item.content}
                          </div>
                        </div>
                      </div>
                      
                      {isSelected && selectedPrompts.length > 1 && (
                        <div className="flex items-center gap-3 pl-8 pt-2">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={currentWeight}
                            onChange={(e) => handleUpdateWeight(item.id, parseInt(e.target.value, 10))}
                            className="flex-1 accent-amber-500"
                          />
                          <span className="text-sm font-mono w-12 text-right">{currentWeight}%</span>
                        </div>
                      )}
                      {isSelected && selectedPrompts.length === 1 && (
                        <div className="flex items-center gap-3 pl-8 pt-2">
                          <div className="flex-1 h-2 bg-amber-500 rounded-full opacity-80" />
                          <span className="text-sm font-mono w-12 text-right">100%</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          
          <DialogFooter className="mt-2 border-t pt-4">
            {!isEditingDistribution ? (
              <div className="flex w-full justify-between sm:justify-between items-center">
                <Button variant="outline" onClick={() => setDistributionModalOpen(false)}>Close</Button>
                <Button onClick={() => setIsEditingDistribution(true)}>Edit Distribution</Button>
              </div>
            ) : (
              <div className="flex w-full justify-between sm:justify-between items-center">
                <div className="text-sm font-medium text-muted-foreground">
                  {selectedPrompts.length === 0 ? "0 versions selected" : `${selectedPrompts.length}/2 versions selected`}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsEditingDistribution(false)}>Cancel</Button>
                  <Button onClick={handleSaveDistribution} disabled={savingDist}>
                    {savingDist && <Loader2 className="mr-2 size-4 animate-spin" />}
                    {selectedPrompts.length === 0 ? "Unpublish All" : "Save & Publish"}
                  </Button>
                </div>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                    {!isEvaluationPrompt && item.traffic_weight && item.traffic_weight > 0 ? (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30">
                        {item.traffic_weight}% Traffic
                      </Badge>
                    ) : null}
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
