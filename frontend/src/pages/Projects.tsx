import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { FolderOpen, Loader2, Plus } from "lucide-react"
import { toast } from "sonner"

import { projectsApi } from "@/api"
import type { Project } from "@/api/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { formatRelativeTime } from "@/lib/utils"

export function ProjectsPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  const load = async () => {
    setError(false)
    try {
      setProjects(null)
      const data = await projectsApi.list()
      setProjects(data)
    } catch (err) {
      setError(true)
      toast.error(err instanceof Error ? err.message : "Failed to load projects")
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleCreate = async () => {
    if (!name.trim()) return
    setCreating(true)
    try {
      const created = await projectsApi.create({
        name: name.trim(),
        description: description.trim(),
      })
      toast.success("Project created")
      setOpen(false)
      setName("")
      setDescription("")
      navigate(`/projects/${created.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create project")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm">
            Manage prompts, test cases, providers, and evaluation runs.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" />
              New project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create project</DialogTitle>
              <DialogDescription>
                A default system prompt and evaluation rubric will be seeded.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="project-name">Name</Label>
                <Input
                  id="project-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Customer support assistant"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="project-description">Description</Label>
                <Textarea
                  id="project-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional notes about this project"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating || !name.trim()}>
                {creating && <Loader2 className="size-4 animate-spin" />}
                Create project
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {projects === null && !error && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-muted-foreground text-sm">
              Could not load projects. Is the backend running on :8080?
            </p>
            <Button variant="outline" onClick={load}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {projects !== null && projects.length === 0 && !error && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="bg-muted flex size-12 items-center justify-center rounded-full">
              <FolderOpen className="text-muted-foreground size-5" />
            </div>
            <div>
              <p className="font-medium">No projects yet</p>
              <p className="text-muted-foreground text-sm">
                Create your first project to start evaluating prompts.
              </p>
            </div>
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              New project
            </Button>
          </CardContent>
        </Card>
      )}

      {projects !== null && projects.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card
              key={p.id}
              className="hover:border-primary/40 hover:shadow-md group cursor-pointer transition-all"
              onClick={() => navigate(`/projects/${p.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base group-hover:text-primary">
                    {p.name}
                  </CardTitle>
                  <Badge variant="secondary">{formatRelativeTime(p.created_at)}</Badge>
                </div>
                <CardDescription className="line-clamp-2 min-h-[2.5rem]">
                  {p.description || "No description provided."}
                </CardDescription>
              </CardHeader>
              <CardFooter className="text-muted-foreground text-xs">
                Updated {formatRelativeTime(p.updated_at)}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
