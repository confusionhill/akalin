import { useEffect, useState } from "react"
import { Wrench, Check, Save, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { projectToolsApi, toolsApi } from "@/api"
import type { Tool } from "@/api/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { FormattedResult } from "@/components/ui/formatted-result"

export function ProjectToolsTab({ projectId }: { projectId: string }) {
  const [globalTools, setGlobalTools] = useState<Tool[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const [allTools, activeTools] = await Promise.all([

        toolsApi.list(),
        projectToolsApi.list(projectId),
      ])
      setGlobalTools(allTools)
      setSelectedIds(new Set(activeTools.map((t) => t.id)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load project tools")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [projectId])

  const toggleTool = (toolId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(toolId)) {
        next.delete(toolId)
      } else {
        next.add(toolId)
      }
      return next
    })
  }

  const handleSave = async () => {
    if (!projectId) return
    setSaving(true)
    try {
      await projectToolsApi.update(projectId, Array.from(selectedIds))
      toast.success("Project tools updated successfully")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update project tools")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (!globalTools || globalTools.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <Wrench className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No Global Tools Available</h3>
          <p className="text-muted-foreground mt-1 max-w-md">
            Go to the global "Tools" page to define tool schemas before assigning them to this project.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Project Available Tools</h3>
          <p className="text-sm text-muted-foreground">
            Select which global tools are active and available for test cases in this project.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="self-start sm:self-auto">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Selection
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {globalTools.map((tool) => {
          const isSelected = selectedIds.has(tool.id)
          return (
            <Card
              key={tool.id}
              className={`cursor-pointer transition-colors ${
                isSelected ? "border-primary bg-primary/5" : "hover:border-muted-foreground/50"
              }`}
              onClick={() => toggleTool(tool.id)}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleTool(tool.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-primary" />
                      {tool.name}
                    </CardTitle>
                  </div>
                  {isSelected && (
                    <Badge variant="default" className="text-xs">
                      <Check className="mr-1 h-3 w-3" /> Active
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs mt-2 line-clamp-2">
                  {tool.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="bg-muted/80 rounded p-2 text-xs font-mono truncate">
                  Result: <FormattedResult result={tool.result} parameters={tool.parameters} />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
