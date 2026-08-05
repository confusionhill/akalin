import { useEffect, useState } from "react"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { testCasesApi } from "@/api"
import type { TestCase } from "@/api/types"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { formatRelativeTime, truncate } from "@/lib/utils"

interface FormState {
  input_prompt: string
  expected_output: string
}

const empty: FormState = { input_prompt: "", expected_output: "" }

export function TestCasesTab({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<TestCase[] | null>(null)
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<TestCase | null>(null)
  const [form, setForm] = useState<FormState>(empty)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setError(false)
    try {
      setItems(null)
      const data = await testCasesApi.list(projectId)
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
    setForm(empty)
    setOpen(true)
  }

  const openEdit = (tc: TestCase) => {
    setEditing(tc)
    setForm({
      input_prompt: tc.input_prompt,
      expected_output: tc.expected_output,
    })
    setOpen(true)
  }

  const handleSave = async () => {
    if (!form.input_prompt.trim() || !form.expected_output.trim()) return
    setSaving(true)
    try {
      if (editing) {
        await testCasesApi.update(projectId, editing.id, {
          input_prompt: form.input_prompt.trim(),
          expected_output: form.expected_output.trim(),
        })
        toast.success("Test case updated")
      } else {
        await testCasesApi.create(projectId, {
          input_prompt: form.input_prompt.trim(),
          expected_output: form.expected_output.trim(),
        })
        toast.success("Test case created")
      }
      setOpen(false)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (tc: TestCase) => {
    try {
      await testCasesApi.remove(projectId, tc.id)
      toast.success("Test case deleted")
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Test cases</h3>
          <p className="text-muted-foreground text-sm">
            Input/expected pairs used to grade prompt runs.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={openCreate}>
          <Plus className="size-4" />
          Add test case
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit test case" : "New test case"}
            </DialogTitle>
            <DialogDescription>
              The generated output will be graded against the expected output.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="tc-input">Input prompt</Label>
              <Textarea
                id="tc-input"
                value={form.input_prompt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, input_prompt: e.target.value }))
                }
                placeholder="User-facing input for the target model"
                className="min-h-24"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tc-expected">Expected output</Label>
              <Textarea
                id="tc-expected"
                value={form.expected_output}
                onChange={(e) =>
                  setForm((f) => ({ ...f, expected_output: e.target.value }))
                }
                placeholder="Reference answer used for grading"
                className="min-h-24"
              />
            </div>
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
              disabled={
                saving ||
                !form.input_prompt.trim() ||
                !form.expected_output.trim()
              }
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {items === null && !error && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
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
            No test cases yet.
          </CardContent>
        </Card>
      )}

      {items !== null && items.length > 0 && (
        <div className="flex flex-col gap-3">
          {items.map((tc) => (
            <Card key={tc.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    {truncate(tc.input_prompt, 70)}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(tc)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(tc)}
                    >
                      <Trash2 className="text-destructive size-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Badge variant="outline" className="mb-1.5">
                    Input
                  </Badge>
                  <p className="text-muted-foreground line-clamp-3 text-xs">
                    {tc.input_prompt}
                  </p>
                </div>
                <div>
                  <Badge variant="info" className="mb-1.5">
                    Expected
                  </Badge>
                  <p className="text-muted-foreground line-clamp-3 text-xs">
                    {tc.expected_output}
                  </p>
                </div>
                <p className="text-muted-foreground col-span-full text-[11px]">
                  Updated {formatRelativeTime(tc.updated_at)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
