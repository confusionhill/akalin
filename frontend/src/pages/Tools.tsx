import { useEffect, useState } from "react"
import { Wrench, Plus, Pencil, Trash2, Code, AlignLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { toolsApi } from "@/api"
import type { Tool } from "@/api/types"
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
import { Textarea } from "@/components/ui/textarea"
import { HighlightedTextarea } from "@/components/ui/highlighted-textarea"
import { FormattedResult } from "@/components/ui/formatted-result"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { formatRelativeTime } from "@/lib/utils"

interface ParamRow {
  id: string
  name: string
  type: string
  description: string
  required: boolean
}

interface FormState {
  name: string
  description: string
  format: "json" | "text"
  result: string
  params: ParamRow[]
}

const empty: FormState = {
  name: "",
  description: "",
  format: "text",
  result: "",
  params: []
}

export function ToolsPage() {
  const [items, setItems] = useState<Tool[] | null>(null)
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Tool | null>(null)
  const [form, setForm] = useState<FormState>(empty)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setError(false)
    try {
      setItems(null)
      const data = await toolsApi.list()
      setItems(data)
    } catch (err) {
      setError(true)
      toast.error(err instanceof Error ? err.message : "Failed to load tools")
    }
  }

  useEffect(() => {
    load()
  }, [])

  const startCreate = () => {
    setEditing(null)
    setForm(empty)
    setOpen(true)
  }

  const startEdit = (t: Tool) => {
    setEditing(t)
    let isJson = false
    try {
      JSON.parse(t.result)
      isJson = true
    } catch {
      isJson = false
    }

    const params: ParamRow[] = []
    if (t.parameters && t.parameters.properties) {
      Object.entries(t.parameters.properties).forEach(([key, val]: [string, any]) => {
        params.push({
          id: Math.random().toString(36).substring(7),
          name: key,
          type: val.type || "string",
          description: val.description || "",
          required: Array.isArray(t.parameters.required) && t.parameters.required.includes(key),
        })
      })
    }

    setForm({
      name: t.name,
      description: t.description,
      format: isJson ? "json" : "text",
      result: t.result,
      params,
    })
    setOpen(true)
  }

  const handleFormatChange = (fmt: "json" | "text") => {
    setForm((prev) => {
      let newResult = prev.result
      if (fmt === "json" && prev.result.trim()) {
        try {
          const parsed = JSON.parse(prev.result)
          newResult = JSON.stringify(parsed, null, 2)
        } catch {
          // Keep as is if invalid JSON
        }
      }
      return { ...prev, format: fmt, result: newResult }
    })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.description.trim() || !form.result.trim()) {
      toast.error("Name, description, and mock result are required")
      return
    }

    const matches = form.result.match(/\{\{([^{}]+)\}\}/g) || []
    const paramNames = new Set(form.params.map(p => p.name.trim()).filter(Boolean))
    const missingParams: string[] = []
    matches.forEach(match => {
      const varName = match.slice(2, -2).trim()
      if (!paramNames.has(varName)) {
        missingParams.push(match)
      }
    })

    if (missingParams.length > 0) {
      toast.error(`The following variables are not defined in the tool parameters: ${missingParams.join(", ")}`)
      return
    }

    if (form.format === "json") {
      try {
        JSON.parse(form.result)
      } catch (err) {
        toast.error("Invalid JSON content in mock result")
        return
      }
    }

    const parameters = {
      type: "object",
      properties: {} as Record<string, any>,
      required: [] as string[]
    }
    form.params.forEach(p => {
      if (!p.name.trim()) return
      parameters.properties[p.name] = {
        type: p.type,
        description: p.description
      }
      if (p.required) {
        parameters.required.push(p.name)
      }
    })

    setSaving(true)
    try {
      if (editing) {
        await toolsApi.update(editing.id, {
          name: form.name,
          description: form.description,
          parameters,
          result: form.result,
        })
        toast.success("Tool updated successfully")
      } else {
        await toolsApi.create({
          name: form.name,
          description: form.description,
          parameters,
          result: form.result,
        })
        toast.success("Tool created successfully")
      }
      setOpen(false)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save tool")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (t: Tool) => {
    if (!confirm(`Delete tool "${t.name}"?`)) return
    try {
      await toolsApi.remove(t.id)
      toast.success("Tool deleted")
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete tool")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mock Tools</h1>
          <p className="text-muted-foreground mt-1">
            Global catalog of tools that can be mocked and assigned to evaluation projects.
          </p>
        </div>
        <Button onClick={startCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add Tool
        </Button>
      </div>

      {items === null && !error && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-6 text-center text-destructive">
            Failed to load mock tools catalog.{" "}
            <Button variant="link" onClick={load} className="p-0 font-semibold underline">
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {items !== null && items.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Wrench className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold">No tools created yet</h3>
            <p className="text-muted-foreground mt-1 max-w-md">
              Create global tools to define function names, descriptions, and static mock outputs for LLM pipeline testing.
            </p>
            <Button onClick={startCreate} className="mt-4">
              <Plus className="mr-2 h-4 w-4" /> Add First Tool
            </Button>
          </CardContent>
        </Card>
      )}

      {items !== null && items.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((tool) => {
            let isJson = false
            try {
              JSON.parse(tool.result)
              isJson = true
            } catch {
              isJson = false
            }

            return (
              <Card key={tool.id} className="relative flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-primary" />
                      {tool.name}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {isJson ? <Code className="mr-1 h-3 w-3" /> : <AlignLeft className="mr-1 h-3 w-3" />}
                      {isJson ? "JSON" : "Text"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {tool.description}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="bg-muted rounded-md p-2 text-xs font-mono max-h-24 overflow-y-auto whitespace-pre-wrap">
                    <FormattedResult result={tool.result} parameters={tool.parameters} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                    <span>Updated {formatRelativeTime(tool.updated_at)}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(tool)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(tool)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Mock Tool" : "Add Mock Tool"}</DialogTitle>
            <DialogDescription>
              Define tool schema and mock result to simulate tool calling in evaluation runs.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">Tool Name (Function Identifier)</Label>
              <Input
                id="name"
                placeholder="e.g. get_weather, calculator"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Sent to LLM)</Label>
              <Textarea
                id="description"
                rows={2}
                placeholder="Describes what the tool does and when to call it..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="space-y-2 pt-2 border-t mt-2">
              <div className="flex items-center justify-between">
                <Label>Parameters (Arguments)</Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-xs"
                  onClick={() => setForm(prev => ({ 
                    ...prev, 
                    params: [...prev.params, { id: Math.random().toString(36).substring(7), name: "", type: "string", description: "", required: false }] 
                  }))}
                >
                  <Plus className="mr-1 h-3 w-3" /> Add Row
                </Button>
              </div>
              
              {form.params.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {form.params.map((p, idx) => (
                    <div key={p.id} className="flex gap-2 items-start bg-muted/50 p-2 rounded border border-border/50">
                      <div className="space-y-1 flex-[2]">
                        <Input 
                          placeholder="Name (e.g. city)" 
                          className="h-8 text-xs bg-background"
                          value={p.name}
                          onChange={(e) => {
                            const newParams = [...form.params]
                            newParams[idx].name = e.target.value
                            setForm({ ...form, params: newParams })
                          }}
                        />
                      </div>
                      <div className="space-y-1 w-[80px]">
                        <Select 
                          value={p.type} 
                          onValueChange={(val) => {
                            const newParams = [...form.params]
                            newParams[idx].type = val
                            setForm({ ...form, params: newParams })
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background px-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="string">String</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="boolean">Bool</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1 flex-[3]">
                        <Input 
                          placeholder="Description..." 
                          className="h-8 text-xs bg-background"
                          value={p.description}
                          onChange={(e) => {
                            const newParams = [...form.params]
                            newParams[idx].description = e.target.value
                            setForm({ ...form, params: newParams })
                          }}
                        />
                      </div>
                      <div className="flex flex-col gap-1 items-center justify-center pt-1">
                        <Checkbox 
                          checked={p.required}
                          onCheckedChange={(checked) => {
                            const newParams = [...form.params]
                            newParams[idx].required = checked as boolean
                            setForm({ ...form, params: newParams })
                          }}
                        />
                        <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold leading-none">Req</span>
                      </div>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive shrink-0 -mr-1"
                        onClick={() => {
                          setForm({
                            ...form,
                            params: form.params.filter((_, i) => i !== idx)
                          })
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground bg-muted p-2 rounded text-center">
                  No parameters defined. The tool will not receive any arguments.
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t mt-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="result">Mock Result Output</Label>
                <Select value={form.format} onValueChange={(v: "json" | "text") => handleFormatChange(v)}>
                  <SelectTrigger className="h-7 w-[120px] text-xs">
                    <SelectValue placeholder="Format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Plain Text</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <HighlightedTextarea
                id="result"
                rows={4}
                className="font-mono text-xs"
                placeholder={form.format === "json" ? '{"status": "success", "data": 42}' : "Result text to return when tool is executed..."}
                value={form.result}
                onChange={(e) => setForm({ ...form, result: e.target.value })}
                allowedVariables={form.params.map(p => p.name.trim()).filter(Boolean)}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Tip: You can use <code className="bg-muted px-1 py-0.5 rounded">{"{{argName}}"}</code> to dynamically interpolate tool arguments provided by the LLM into this mock result.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Save Changes" : "Create Tool"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
