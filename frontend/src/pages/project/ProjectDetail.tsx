import { useEffect, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { ArrowLeft, Loader2, Pencil, Terminal, FileText, CheckSquare, Wrench, BarChart3, ChevronDown } from "lucide-react"
import { toast } from "sonner"

import { evaluationPromptsApi, projectsApi, systemPromptsApi } from "@/api"
import type { Project } from "@/api/types"
import { Button } from "@/components/ui/button"
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
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EvaluationsTab } from "@/pages/project/EvaluationsTab"
import { PromptVersionsTab } from "@/pages/project/PromptVersionsTab"
import { TestCasesTab } from "@/pages/project/TestCasesTab"
import { cn, formatRelativeTime } from "@/lib/utils"

import { ProjectToolsTab } from "@/pages/project/ProjectTools"

export function ProjectDetailPage() {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState("")
  const [editDesc, setEditDesc] = useState("")
  const [saving, setSaving] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get("tab") || "prompts"

  useEffect(() => {
    let active = true
    setLoading(true)
    projectsApi
      .get(id)
      .then((p) => {
        if (active) setProject(p)
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to load project")
        if (active) navigate("/projects", { replace: true })
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id, navigate])

  const sections = [
    { id: "prompts", label: "System prompts", icon: Terminal },
    { id: "rubric", label: "Evaluation prompts", icon: FileText },
    { id: "cases", label: "Test cases", icon: CheckSquare },
    { id: "tools", label: "Tools", icon: Wrench },
    { id: "evaluations", label: "Evaluations", icon: BarChart3 },
  ]

  const setActiveTab = (val: string) => {
    setSearchParams((prev) => {
      prev.set("tab", val)
      return prev
    })
  }

  const openEdit = () => {
    setEditName(project?.name ?? "")
    setEditDesc(project?.description ?? "")
    setEditOpen(true)
  }

  const handleSave = async () => {
    if (!editName.trim()) return
    setSaving(true)
    try {
      const updated = await projectsApi.update(id, {
        name: editName.trim(),
        description: editDesc.trim(),
      })
      setProject(updated)
      toast.success("Project updated")
      setEditOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update project")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/projects")}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          {loading ? (
            <Skeleton className="h-7 w-48" />
          ) : (
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {project?.name ?? "Project"}
            </h1>
          )}
          <p className="text-muted-foreground truncate text-sm">
            {project?.description || "No description"}
            {project && <> · created {formatRelativeTime(project.created_at)}</>}
          </p>
        </div>
        {!loading && (
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Pencil className="size-4" />
            Edit
          </Button>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
            <DialogDescription>
              Update the project name and description.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea
                id="edit-desc"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="min-h-20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !editName.trim()}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <LoadingPanel />
      ) : (
        <div className="flex flex-col md:flex-row gap-8 items-start relative">
          {/* Mobile sticky header/selector */}
          <div className="md:hidden sticky top-0 z-40 bg-background/95 backdrop-blur border-b py-3 mb-4 -mx-4 px-4 w-[calc(100%+2rem)] flex items-center justify-between">
            <span className="text-sm font-semibold text-muted-foreground">Section:</span>
            <Select value={activeTab} onValueChange={(val) => setActiveTab(val)}>
              <SelectTrigger className="w-56 flex items-center gap-2">
                <SelectValue placeholder="Select Section" />
              </SelectTrigger>
              <SelectContent>
                {sections.map((s) => {
                  const Icon = s.icon
                  return (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        <Icon className="size-4" />
                        {s.label}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Desktop Sidebar */}
          <aside className="hidden md:block w-64 shrink-0 sticky top-6 space-y-1 bg-card border rounded-lg p-3 shadow-xs">
            <div className="font-semibold text-xs text-muted-foreground uppercase tracking-wider px-3 mb-2">
              Project Navigation
            </div>
            {sections.map((s) => {
              const isActive = activeTab === s.id
              const Icon = s.icon
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveTab(s.id)}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium rounded-md transition-all text-left",
                    isActive
                      ? "bg-primary/10 text-primary font-semibold border-l-2 border-primary pl-2.5 rounded-l-none"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className={cn("size-4", isActive ? "text-primary" : "text-muted-foreground")} />
                  {s.label}
                </button>
              )
            })}
          </aside>

          {/* Content area - lazy loaded */}
          <div className="flex-1 min-w-0 w-full">
            {activeTab === "prompts" && (
              <PromptVersionsTab
                projectId={id}
                api={systemPromptsApi}
                title="System prompts"
                description="Versioned system prompts sent to the target model."
                placeholder="You are a helpful assistant..."
              />
            )}

            {activeTab === "rubric" && (
              <PromptVersionsTab
                projectId={id}
                api={evaluationPromptsApi}
                title="Evaluation Prompts"
                description="Instructions defining the evaluation rubric and scoring criteria."
                placeholder="e.g. Evaluate the output based on clarity and accuracy. Score 1.0 for perfect, 0.0 for wrong."
                isEvaluationPrompt
              />
            )}

            {activeTab === "cases" && <TestCasesTab projectId={id} />}

            {activeTab === "tools" && <ProjectToolsTab projectId={id} />}

            {activeTab === "evaluations" && <EvaluationsTab projectId={id} />}
          </div>
        </div>
      )}
    </div>
  )
}


function LoadingPanel() {
  return (
    <div className="flex items-center gap-2 py-10 text-muted-foreground text-sm">
      <Loader2 className="size-4 animate-spin" />
      Loading...
    </div>
  )
}
