import { useState, useEffect } from "react"
import { Loader2, Sparkles, CheckCircle2, XCircle } from "lucide-react"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"

import { rubricDraftsApi } from "@/api"
import type { RubricDraft } from "@/api/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface RefineRubricModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  runId: string
  basePromptId?: string
}

export function RefineRubricModal({
  open,
  onOpenChange,
  projectId,
  runId,
  basePromptId,
}: RefineRubricModalProps) {
  const navigate = useNavigate()
  const [customInstructions, setCustomInstructions] = useState("")
  const [draftId, setDraftId] = useState<string | null>(null)
  const [draft, setDraft] = useState<RubricDraft | null>(null)
  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(false)

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setCustomInstructions("")
      setDraftId(null)
      setDraft(null)
      setLoading(false)
      setPolling(false)
    }
  }, [open])

  // Poll for draft status
  useEffect(() => {
    if (!polling || !draftId) return

    const interval = setInterval(async () => {
      try {
        const data = await rubricDraftsApi.get(projectId, draftId)
        setDraft(data)
        if (data.status !== "pending" && data.status !== "running") {
          setPolling(false)
          clearInterval(interval)
          if (data.status === "completed") {
            toast.success("Rubric refined successfully!")
          } else if (data.status === "failed") {
            toast.error(`Refinement failed: ${data.failure_reason}`)
          }
        }
      } catch (err) {
        setPolling(false)
        clearInterval(interval)
        toast.error("Failed to get draft status")
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [polling, draftId, projectId])

  const handleStart = async () => {
    setLoading(true)
    try {
      const res = await rubricDraftsApi.refineFromRun(projectId, runId, basePromptId, customInstructions)
      setDraftId(res.draft_id)
      setPolling(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start refinement")
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (draftId && (draft?.status === "pending" || draft?.status === "running")) {
      try {
        await rubricDraftsApi.cancel(projectId, draftId)
        toast.info("Refinement cancelled")
      } catch (err) {
        toast.error("Failed to cancel")
      }
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !polling && onOpenChange(open)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-indigo-500" />
            Auto-Refine Rubric
          </DialogTitle>
          <DialogDescription>
            The meta-LLM will analyze the test cases, expected outputs, and actual scores of this run to improve the evaluation rubric.
          </DialogDescription>
        </DialogHeader>

        {!draftId ? (
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="customInstructions">Custom Instructions (Optional)</Label>
              <Textarea
                id="customInstructions"
                placeholder="e.g. Focus on penalizing verbose answers, or ensure the prompt ignores formatting issues..."
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleStart} disabled={loading}>
                {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                Start Refinement
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            {draft?.status === "completed" ? (
              <>
                <CheckCircle2 className="size-12 text-emerald-500" />
                <p className="text-sm font-medium">Refinement Complete</p>
                <div className="flex w-full justify-end gap-3 mt-4">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Close
                  </Button>
                  <Button onClick={() => navigate(`/projects/${projectId}/evaluation-prompts?draft=${draftId}`)}>
                    View Draft
                  </Button>
                </div>
              </>
            ) : draft?.status === "failed" ? (
              <>
                <XCircle className="size-12 text-destructive" />
                <p className="text-sm font-medium text-destructive">Refinement Failed</p>
                <p className="text-xs text-muted-foreground">{draft.failure_reason}</p>
                <div className="flex justify-end gap-3 mt-4 w-full">
                  <Button onClick={() => onOpenChange(false)}>Close</Button>
                </div>
              </>
            ) : (
              <>
                <Loader2 className="size-12 animate-spin text-indigo-500" />
                <p className="text-sm font-medium animate-pulse">Analyzing run results and generating rubric...</p>
                <p className="text-xs text-muted-foreground">This may take a minute or two.</p>
                <div className="flex justify-end gap-3 mt-4 w-full">
                  <Button variant="destructive" onClick={handleCancel}>
                    Cancel Refinement
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
