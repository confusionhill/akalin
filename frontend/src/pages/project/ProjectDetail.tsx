import { useEffect, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { ArrowLeft, Loader2, Pencil } from "lucide-react"
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
import { EvaluationsTab } from "@/pages/project/EvaluationsTab"
import { PromptVersionsTab } from "@/pages/project/PromptVersionsTab"
import { TestCasesTab } from "@/pages/project/TestCasesTab"
import { formatRelativeTime } from "@/lib/utils"

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

      <Tabs 
        value={activeTab} 
        onValueChange={(val) => setSearchParams((prev) => { prev.set("tab", val); return prev; })}
        className="w-full"
      >
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="prompts">System prompts</TabsTrigger>
          <TabsTrigger value="rubric">Evaluation prompts</TabsTrigger>
          <TabsTrigger value="cases">Test cases</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
          <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
        </TabsList>

        <TabsContent value="prompts">
          {loading ? (
            <LoadingPanel />
          ) : (
            <PromptVersionsTab
              projectId={id}
              api={systemPromptsApi}
              title="System prompts"
              description="Versioned system prompts sent to the target model."
              placeholder="You are a helpful assistant..."
            />
          )}
        </TabsContent>

        <TabsContent value="rubric">
          {loading || !project ? (
            <LoadingPanel />
          ) : (
            <PromptVersionsTab
              projectId={project.id}
              api={evaluationPromptsApi}
              title="Evaluation Prompts"
              description="Instructions defining the evaluation rubric and scoring criteria."
              placeholder="e.g. Evaluate the output based on clarity and accuracy. Score 1.0 for perfect, 0.0 for wrong."
              isEvaluationPrompt
            />
          )}
        </TabsContent>

        <TabsContent value="cases">
          {loading ? <LoadingPanel /> : <TestCasesTab projectId={id} />}
        </TabsContent>

        <TabsContent value="tools">
          {loading ? <LoadingPanel /> : <ProjectToolsTab projectId={id} />}
        </TabsContent>


        <TabsContent value="evaluations">
          {loading ? <LoadingPanel /> : <EvaluationsTab projectId={id} />}
        </TabsContent>
      </Tabs>
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
