import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowRight, CheckIcon, Loader2, Play, Plus, Trash2, Sparkles, Wrench, XCircle } from "lucide-react"

import { toast } from "sonner"

import {
  evaluationPromptsApi,
  evaluationsApi,
  projectToolsApi,
  providersApi,
  systemPromptsApi,
  testCasesApi,
} from "@/api"
import type {
  EvaluationPrompt,
  EvaluationRun,
  ProviderConfig,
  RunStatus,
  SystemPrompt,
  TestCase,
  Tool,
} from "@/api/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ConfirmDialog"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDateTime, formatRelativeTime } from "@/lib/utils"


const statusVariant: Record<
  RunStatus,
  "warning" | "info" | "success" | "destructive"
> = {
  pending: "warning",
  running: "info",
  completed: "success",
  failed: "destructive",
}

function calculateModelStats(runs: EvaluationRun[]) {
  const completedRuns = runs.filter(r => r.status === "completed" && r.average_score !== null)

  const stats = new Map<string, {
    model: string
    runs: number
    scores: number[]
  }>()

  completedRuns.forEach(run => {
    const model = run.model_used
    if (!stats.has(model)) {
      stats.set(model, { model, runs: 0, scores: [] })
    }
    const stat = stats.get(model)!
    stat.runs++
    stat.scores.push(run.average_score!)
  })

  return Array.from(stats.values())
    .map(({ model, runs, scores }) => ({
      model,
      runs,
      averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      bestScore: Math.max(...scores),
      worstScore: Math.min(...scores),
    }))
    .sort((a, b) => b.averageScore! - a.averageScore!)
}

export function EvaluationsTab({ projectId }: { projectId: string }) {
  const navigate = useNavigate()
  const [runs, setRuns] = useState<EvaluationRun[] | null>(null)
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [sysPrompts, setSysPrompts] = useState<SystemPrompt[]>([])
  const [evalPrompts, setEvalPrompts] = useState<EvaluationPrompt[]>([])
  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [testCases, setTestCases] = useState<TestCase[]>([])
  const [disabledTc, setDisabledTc] = useState<Set<string>>(new Set())
  const [projectTools, setProjectTools] = useState<Tool[]>([])
  const [blacklistedTools, setBlacklistedTools] = useState<Set<string>>(new Set())

  const [systemPromptId, setSystemPromptId] = useState("")
  const [evaluationPromptId, setEvaluationPromptId] = useState("")
  const [targetProviderId, setTargetProviderId] = useState("")
  const [targetModel, setTargetModel] = useState("")
  const [evaluatorProviderId, setEvaluatorProviderId] = useState("")
  const [evaluatorModel, setEvaluatorModel] = useState("")
  const [threshold, setThreshold] = useState("0.8")
  const [enableMemory, setEnableMemory] = useState(false)

  const load = async () => {
    setError(false)
    try {
      setRuns(null)
      const data = await evaluationsApi.list(projectId)
      setRuns(data)
    } catch (err) {
      setError(true)
      toast.error(err instanceof Error ? err.message : "Failed to load")
    }
  }

  const loadFormOptions = async () => {
    try {
      const [sp, ep, pv, tc, pt] = await Promise.all([
        systemPromptsApi.list(projectId),
        evaluationPromptsApi.list(projectId),
        providersApi.list(),
        testCasesApi.list(projectId),
        projectToolsApi.list(projectId),
      ])
      setSysPrompts(sp)
      setEvalPrompts(ep)
      setProviders(pv)
      setTestCases(tc)
      setProjectTools(pt)
      setDisabledTc(new Set())
      setBlacklistedTools(new Set())
      if (sp.length > 0) setSystemPromptId(sp[0].id)
      if (ep.length > 0) setEvaluationPromptId(ep[0].id)
      if (pv.length > 0) {
        setTargetProviderId(pv[0].id)
        setEvaluatorProviderId(pv[0].id)
      }
    } catch {
      // ignore; toast handled by callers
    }
  }


  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const openDialog = async () => {
    await loadFormOptions()
    setOpen(true)
  }

  const handleCreate = async () => {
    if (
      !systemPromptId ||
      !evaluationPromptId ||
      !targetProviderId ||
      !evaluatorProviderId ||
      !targetModel.trim() ||
      !evaluatorModel.trim()
    ) {
      return
    }
    const enabledCount = testCases.length - disabledTc.size
    if (enabledCount === 0) {
      toast.error("Enable at least one test case to run")
      return
    }
    setSaving(true)
    try {
      await evaluationsApi.create(projectId, {
        system_prompt_id: systemPromptId,
        evaluation_prompt_id: evaluationPromptId,
        target_provider_id: targetProviderId,
        target_model: targetModel.trim(),
        evaluator_provider_id: evaluatorProviderId,
        evaluator_model: evaluatorModel.trim(),
        model_used: targetModel.trim(),
        pass_threshold: Number.parseFloat(threshold) || 0,
        blacklisted_test_case_ids: Array.from(disabledTc),
        blacklisted_tool_ids: Array.from(blacklistedTools),
        enable_memory: enableMemory,
      })
      toast.success("Evaluation run started")
      setOpen(false)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start run")
    } finally {
      setSaving(false)
    }

  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      setDeleting(true)
      await evaluationsApi.remove(projectId, deleteId)
      toast.success("Evaluation run deleted")
      setDeleteId(null)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete run")
    } finally {
      setDeleting(false)
    }
  }

  const handleCancel = async (runId: string) => {
    try {
      await evaluationsApi.cancel(projectId, runId)
      toast.success("Evaluation run cancelled")
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel run")
    }
  }

  const ready =
    sysPrompts.length > 0 &&
    evalPrompts.length > 0 &&
    providers.length > 0 &&
    testCases.length > 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Evaluation runs</h3>
          <p className="text-muted-foreground text-sm">
            Async runs graded against the configured rubric.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={openDialog}>
          <Plus className="size-4" />
          New run
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Start evaluation run</DialogTitle>
            <DialogDescription>
              Select prompts, providers, models, and a pass threshold.
            </DialogDescription>
          </DialogHeader>
          {!ready ? (
            <div className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
              You need at least one system prompt, one evaluation prompt, and one
              provider before starting a run.
            </div>
          ) : (
            <div className="flex w-full min-w-0 flex-col gap-4">
              <FormField label="System prompt">
                  <Select
                    value={systemPromptId}
                    onValueChange={setSystemPromptId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select version" />
                    </SelectTrigger>
                    <SelectContent>
                      {sysPrompts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          v{p.version}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Evaluation prompt">
                  <Select
                    value={evaluationPromptId}
                    onValueChange={setEvaluationPromptId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select version" />
                    </SelectTrigger>
                    <SelectContent>
                      {evalPrompts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          v{p.version}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Target provider">
                  <Select
                    value={targetProviderId}
                    onValueChange={setTargetProviderId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Target model">
                  <Input
                    value={targetModel}
                    onChange={(e) => setTargetModel(e.target.value)}
                    placeholder="gpt-4o-mini"
                  />
                </FormField>
                <FormField label="Evaluator provider">
                  <Select
                    value={evaluatorProviderId}
                    onValueChange={setEvaluatorProviderId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Evaluator model">
                  <Input
                    value={evaluatorModel}
                    onChange={(e) => setEvaluatorModel(e.target.value)}
                    placeholder="gpt-4o"
                  />
                </FormField>
<FormField label="Pass threshold (0.0 – 1.0)">
                 <Input
                   type="number"
                   min={0}
                   max={1}
                   step={0.05}
                   value={threshold}
                   onChange={(e) => setThreshold(e.target.value)}
                 />
               </FormField>

               <FormField label="Enable memory">
                 <div className="flex items-center gap-2">
                   <button
                     type="button"
                     onClick={() => setEnableMemory(!enableMemory)}
                     className={
                       "inline-flex h-6 w-11 items-center rounded-full transition-colors " +
                       (enableMemory ? "bg-primary" : "bg-input")
                     }
                   >
                     <span
                       className={
                         "inline-block h-4 w-4 transform rounded-full bg-white transition-transform " +
                         (enableMemory ? "translate-x-5" : "translate-x-1")
                       }
                     />
                   </button>
                   <span className="text-sm text-muted-foreground">
                     {enableMemory ? "ON" : "OFF"}
                   </span>
                 </div>
               </FormField>

              <div className="flex w-full min-w-0 flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label>Test cases</Label>
                  <span className="text-muted-foreground text-xs">
                    {testCases.length - disabledTc.size} of {testCases.length}{" "}
                    enabled
                  </span>
                </div>
                <div className="flex max-h-64 w-full min-w-0 flex-col gap-1.5 overflow-y-auto">
                  {testCases.map((tc) => {
                    const enabled = !disabledTc.has(tc.id)
                    return (
                      <button
                        key={tc.id}
                        type="button"
                        onClick={() =>
                          setDisabledTc((prev) => {
                            const next = new Set(prev)
                            if (next.has(tc.id)) next.delete(tc.id)
                            else next.add(tc.id)
                            return next
                          })
                        }
                        className={
                          "flex w-full min-w-0 items-start gap-2 rounded-md border px-3 py-2 text-left transition-colors " +
                          (enabled
                            ? "border-border hover:bg-accent/40"
                            : "border-transparent bg-muted/30 opacity-60 hover:opacity-100")
                        }
                      >
                        <span
                          className={
                            "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border " +
                            (enabled
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input bg-background")
                          }
                        >
                          {enabled && <CheckIcon className="size-3" />}
                        </span>
                        <p className="min-w-0 flex-1 truncate text-xs">
                          {tc.input_prompt}
                        </p>
                      </button>
                    )
                  })}
                </div>
                <p className="text-muted-foreground text-[11px]">
                  All test cases run by default. Tap a row to disable (exclude)
                  it from this run.
                </p>
              </div>

              {projectTools.length > 0 && (
                <div className="flex w-full min-w-0 flex-col gap-2 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5">
                      <Wrench className="size-3.5 text-primary" /> Active Project Tools
                    </Label>
                    <span className="text-muted-foreground text-xs">
                      {projectTools.length - blacklistedTools.size} of {projectTools.length} enabled
                    </span>
                  </div>
                  <div className="flex max-h-40 w-full min-w-0 flex-col gap-1.5 overflow-y-auto">
                    {projectTools.map((t) => {
                      const enabled = !blacklistedTools.has(t.id)
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() =>
                            setBlacklistedTools((prev) => {
                              const next = new Set(prev)
                              if (next.has(t.id)) next.delete(t.id)
                              else next.add(t.id)
                              return next
                            })
                          }
                          className={
                            "flex w-full min-w-0 items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors " +
                            (enabled
                              ? "border-border hover:bg-accent/40"
                              : "border-transparent bg-muted/30 opacity-60 hover:opacity-100")
                          }
                        >
                          <span
                            className={
                              "flex size-4 shrink-0 items-center justify-center rounded border " +
                              (enabled
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-input bg-background")
                            }
                          >
                            {enabled && <CheckIcon className="size-3" />}
                          </span>
                          <div className="flex flex-1 items-center justify-between min-w-0">
                            <span className="truncate text-xs font-semibold">{t.name}</span>
                            <span className="truncate text-[11px] text-muted-foreground ml-2">{t.description}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    All project tools are active by default. Tap to blacklist (disable) tools for this run.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving || !ready}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              Start run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {runs === null && !error && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
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

      {runs !== null && runs.length === 0 && !error && (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            No evaluation runs yet.
          </CardContent>
        </Card>
      )}

      {runs !== null && runs.length > 0 && (
        <div className="flex flex-col gap-2">
          {runs.map((run) => (
            <Card
              key={run.id}
              className="hover:border-primary/40 group cursor-pointer transition-all"
              onClick={() =>
                navigate(`/projects/${projectId}/evaluations/${run.id}`)
              }
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    {run.target_model}
                    <span className="text-muted-foreground">vs</span>
                    {run.evaluator_model}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    {(run.status === "pending" || run.status === "running") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-warning"
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleCancel(run.id)
                        }}
                        title="Cancel Run"
                      >
                        <XCircle className="size-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteId(run.id)
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                    <ArrowRight className="text-muted-foreground group-hover:text-primary size-4 transition-colors" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant[run.status]}>{run.status}</Badge>
                {run.status === "completed" && (
                  <Badge variant={run.is_passed ? "success" : "destructive"}>
                    {run.is_passed ? "Passed" : "Failed"}
                  </Badge>
                )}
                {run.average_score !== null && (
                  <Badge variant="outline">
                    avg {run.average_score.toFixed(2)}
                  </Badge>
                )}
                <Badge variant="outline">
                  threshold {run.pass_threshold.toFixed(2)}
                </Badge>
                <span
                  className="text-muted-foreground ml-auto text-[11px]"
                  title={formatDateTime(run.created_at)}
                >
                  {formatRelativeTime(run.created_at)}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {runs !== null && runs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="size-4" />
              Model Performance Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {calculateModelStats(runs).length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {calculateModelStats(runs).map((stat) => (
                  <div
                    key={stat.model}
                    className="flex flex-col gap-1 rounded-lg border p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{stat.model}</span>
                      <Badge variant="outline">
                        {stat.runs} run{stat.runs !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      Average: <span className="font-medium">{stat.averageScore?.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${(stat.averageScore || 0) * 100}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Best: {stat.bestScore?.toFixed(2)}</span>
                      <span>Worst: {stat.worstScore?.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-4">
                No completed evaluations to display
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete evaluation run?"
        description="This permanently deletes the run and all its results. This cannot be undone."
        confirmLabel="Delete run"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}

function FormField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
