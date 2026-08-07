import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, CheckCircle2, Loader2, RotateCw, Trash2, Wrench, XCircle, Activity, User, Bot, Zap, ChevronDown, ChevronRight, Clock, Sparkles, SlidersHorizontal } from "lucide-react"

import { toast } from "sonner"

import { evaluationsApi } from "@/api"
import type { DetailedResult, RunDetails, RunStatus } from "@/api/types"
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { formatDateTime } from "@/lib/utils"
import { RefineRubricModal } from "./RefineRubricModal"

const statusVariant: Record<
  RunStatus,
  "warning" | "info" | "success" | "destructive"
> = {
  pending: "warning",
  running: "info",
  completed: "success",
  failed: "destructive",
  cancelled: "destructive",
}

export function EvaluationDetailPage() {
  const { id: projectId = "", runId = "" } = useParams()
  const navigate = useNavigate()
  const [run, setRun] = useState<RunDetails | null>(null)
  const [error, setError] = useState(false)
  const [rerunning, setRerunning] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [refineModalOpen, setRefineModalOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current)
      timer.current = null
    }
  }, [])

  const load = useCallback(async () => {
    try {
      const data = await evaluationsApi.details(projectId, runId)
      setRun(data)
      setError(false)
      if (data.status !== "pending" && data.status !== "running") {
        stopPolling()
      }
    } catch (err) {
      setError(true)
      stopPolling()
      toast.error(err instanceof Error ? err.message : "Failed to load run")
    }
  }, [projectId, runId, stopPolling])

  useEffect(() => {
    void load()
    return stopPolling
  }, [load, stopPolling])

  useEffect(() => {
    if (!run) return
    if (run.status !== "pending" && run.status !== "running") return
    if (timer.current) return
    timer.current = setInterval(() => void load(), 2500)
    return stopPolling
  }, [run, load, stopPolling])

  const isRunning = run?.status === "pending" || run?.status === "running"

  const handleRerun = async () => {
    if (!run) return
    setRerunning(true)
    try {
      const created = await evaluationsApi.create(projectId, {
        system_prompt_id: run.system_prompt_id,
        evaluation_prompt_id: run.evaluation_prompt_id,
        target_provider_id: run.target_provider_id,
        target_model: run.target_model,
        evaluator_provider_id: run.evaluator_provider_id,
        evaluator_model: run.evaluator_model,
        model_used: run.model_used,
        pass_threshold: run.pass_threshold,
        blacklisted_test_case_ids: run.blacklisted_test_case_ids ?? [],
        enable_memory: run.enable_memory ?? false,
      })
      toast.success("Re-run started")
      navigate(`/projects/${projectId}/evaluations/${created.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start re-run")
    } finally {
      setRerunning(false)
    }
  }

  const handleDelete = async () => {
    try {
      setDeleting(true)
      await evaluationsApi.remove(projectId, runId)
      toast.success("Evaluation run deleted")
      navigate(`/projects/${projectId}`, { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete run")
      setDeleting(false)
      setConfirmOpen(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/projects/${projectId}`)}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Evaluation run
          </h1>
          <p className="text-muted-foreground font-mono text-xs">
            {runId}
          </p>
        </div>
        {run && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRerun}
              disabled={rerunning}
            >
              {rerunning ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RotateCw className="size-4" />
              )}
              Re-run
            </Button>
            {run.status === "completed" && (
              <Button
                variant="outline"
                size="sm"
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200"
                onClick={() => setRefineModalOpen(true)}
              >
                <Sparkles className="size-4 text-indigo-500" />
                Refine Rubric
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete evaluation run?"
        description="This permanently deletes the run and all its per-test-case results. This cannot be undone."
        confirmLabel="Delete run"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />

      <RefineRubricModal
        open={refineModalOpen}
        onOpenChange={setRefineModalOpen}
        projectId={projectId}
        runId={runId}
        basePromptId={run?.evaluation_prompt_id}
      />

      {!run && !error && (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="flex items-center justify-between py-6">
            <p className="text-muted-foreground text-sm">
              Could not load this evaluation run.
            </p>
            <Button variant="outline" size="sm" onClick={load}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {run && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Model">
              <span className="text-sm font-mono">{run.model_used}</span>
            </SummaryCard>
            <SummaryCard label="Status">
              <div className="flex items-center gap-2">
                {isRunning && <Loader2 className="size-4 animate-spin" />}
                <Badge variant={statusVariant[run.status]}>{run.status}</Badge>
              </div>
            </SummaryCard>
            <SummaryCard label="Average score">
              <span className="text-xl font-semibold">
                {run.average_score !== null
                  ? run.average_score.toFixed(2)
                  : "—"}
              </span>
            </SummaryCard>
            <SummaryCard label="Pass threshold">
              <span className="text-xl font-semibold">
                {run.pass_threshold.toFixed(2)}
              </span>
            </SummaryCard>
            <SummaryCard label="Result">
              {run.status !== "completed" ? (
                <span className="text-muted-foreground">—</span>
              ) : run.is_passed ? (
                <span className="flex items-center gap-1.5 text-emerald-500">
                  <CheckCircle2 className="size-5" /> Passed
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-destructive">
                  <XCircle className="size-5" /> Failed
                </span>
              )}
            </SummaryCard>
          </div>

          {run.advanced_settings && (
            <Card className="bg-muted/40">
              <CardContent className="flex flex-wrap items-center gap-2 py-3 text-xs">
                <span className="font-semibold text-muted-foreground flex items-center gap-1.5 mr-1">
                  <SlidersHorizontal className="size-3.5 text-primary" /> Advanced Settings:
                </span>
                {run.advanced_settings.temperature !== undefined && (
                  <Badge variant="outline" className="bg-background font-mono">
                    temperature: {run.advanced_settings.temperature}
                  </Badge>
                )}
                {run.advanced_settings.top_p !== undefined && (
                  <Badge variant="outline" className="bg-background font-mono">
                    top_p: {run.advanced_settings.top_p}
                  </Badge>
                )}
                {run.advanced_settings.top_k !== undefined && (
                  <Badge variant="outline" className="bg-background font-mono">
                    top_k: {run.advanced_settings.top_k}
                  </Badge>
                )}
                {run.advanced_settings.max_tokens !== undefined && (
                  <Badge variant="outline" className="bg-background font-mono">
                    max_tokens: {run.advanced_settings.max_tokens}
                  </Badge>
                )}
              </CardContent>
            </Card>
          )}

          {run.status === "failed" && run.failure_reason && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="flex items-start gap-2 py-4">
                <XCircle className="text-destructive mt-0.5 size-4 shrink-0" />
                <div className="min-w-0">
                  <p className="text-destructive text-sm font-medium">
                    Evaluation failed
                  </p>
                  <p className="text-muted-foreground break-words font-mono text-xs">
                    {run.failure_reason}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

<Card>
             <CardHeader>
               <CardTitle className="flex items-center gap-2 text-sm">
                 Configuration
                 {run.enable_memory && (
                   <Badge variant="success" className="ml-auto text-xs">
                     Memory: ON
                   </Badge>
                 )}
               </CardTitle>
             </CardHeader>
             <CardContent className="text-muted-foreground grid gap-2 text-sm sm:grid-cols-2">
               <KV label="Target">{run.target_model}</KV>
               <KV label="Evaluator">{run.evaluator_model}</KV>
               <KV label="Model used">{run.model_used}</KV>
               <KV label="Started">{formatDateTime(run.created_at)}</KV>
               <KV label="Completed">{formatDateTime(run.completed_at)}</KV>
               <KV label="Excluded">
                 {(run.blacklisted_test_case_ids?.length ?? 0) > 0
                   ? `${run.blacklisted_test_case_ids.length} test case${run.blacklisted_test_case_ids.length === 1 ? "" : "s"}`
                   : "None"}
               </KV>
               <KV label="Memory">
                 {run.enable_memory ? (
                   <Badge variant="success" className="text-xs">
                     ON
                   </Badge>
                 ) : (
                   <span className="text-xs text-muted-foreground">OFF</span>
                 )}
               </KV>
             </CardContent>
           </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                Per-test-case results
                {isRunning && (
                  <span className="text-muted-foreground text-xs font-normal">
                    (updating…)
                  </span>
                )}
                {!isRunning && (
                  <span className="text-muted-foreground ml-auto text-xs font-normal">
                    {run.results.length} case{run.results.length === 1 ? "" : "s"}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {run.results.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  {isRunning
                    ? "Waiting for results…"
                    : "No results recorded."}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>Input</TableHead>
                      <TableHead>Expected</TableHead>
                      <TableHead>Generated</TableHead>
                      <TableHead className="w-20">Score</TableHead>
                      <TableHead className="w-24">Result</TableHead>
                      <TableHead>Reasoning</TableHead>
                      <TableHead className="w-20">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {run.results.map((r, i) => (
                      <ResultRow key={r.id} result={r} index={i} />
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function ResultRow({ result, index }: { result: DetailedResult; index: number }) {
  const [open, setOpen] = useState(false)
  return (
    <TableRow>
      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
      <TableCell className="max-w-[220px]">
        <p className="text-muted-foreground line-clamp-3 whitespace-normal text-xs">
          {result.input_prompt}
        </p>
      </TableCell>
      <TableCell className="max-w-[220px]">
        <p className="text-muted-foreground line-clamp-3 whitespace-normal text-xs">
          {result.expected_output}
        </p>
      </TableCell>
      <TableCell className="max-w-[220px]">
        {result.generated_output ? (
          <div className="space-y-1">
            <p className="line-clamp-3 whitespace-normal text-xs">
              {result.generated_output}
            </p>
            {result.tools_called && result.tools_called.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {result.tools_called.map((toolName, idx) => (
                  <Badge key={idx} variant="outline" className="text-[10px] py-0 px-1 font-mono flex items-center gap-1">
                    <Wrench className="h-2.5 w-2.5 text-primary" />
                    {toolName}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
      <TableCell>
        {result.score !== null ? (
          <Badge variant="outline">{result.score.toFixed(2)}</Badge>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
      <TableCell>
        {result.is_passed === null ? (
          <span className="text-muted-foreground text-xs">—</span>
        ) : result.is_passed ? (
          <Badge variant="success">pass</Badge>
        ) : (
          <Badge variant="destructive">fail</Badge>
        )}
      </TableCell>
      <TableCell className="max-w-[260px]">
        {result.evaluator_reasoning ? (
          <p className="text-muted-foreground line-clamp-3 whitespace-normal text-xs">
            {result.evaluator_reasoning}
          </p>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          Details
        </Button>
      </TableCell>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Test case #{index + 1}</DialogTitle>
            <DialogDescription>
              Full, untruncated result details.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <DetailField label="Input prompt">
              {result.input_prompt}
            </DetailField>
            <DetailField label="Expected output">
              <div className="flex flex-col gap-1">
                <span>{result.expected_output}</span>
                {result.expected_format === "json" && (
                  <Badge variant="default" className="w-fit text-[10px] bg-purple-600 hover:bg-purple-700 mt-1">
                    Layer 1 Programmatic Check: JSON Expected
                  </Badge>
                )}
              </div>
            </DetailField>
            <DetailField label="Tools called by LLM">
              {result.tools_called && result.tools_called.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {result.tools_called.map((toolName, idx) => (
                    <Badge key={idx} variant="default" className="text-xs font-mono flex items-center gap-1.5 py-1 px-2.5">
                      <Wrench className="h-3 w-3" />
                      {toolName}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground text-xs font-sans">None (Direct Answer)</span>
              )}
            </DetailField>
            <DetailField label="Generated output">
              {result.generated_output ?? "—"}
            </DetailField>
            <div className="flex items-center gap-3">
              <DetailField label="Score">
                {result.score !== null ? result.score.toFixed(2) : "—"}
              </DetailField>
              <DetailField label="Result">
                {result.is_passed === null
                  ? "—"
                  : result.is_passed
                    ? "Passed"
                    : "Failed"}
              </DetailField>
            </div>
            <DetailField label="Evaluator reasoning">
              {result.evaluator_reasoning ?? "—"}
            </DetailField>

            {result.trace && result.trace.length > 0 && (
              <ExecutionTimeline trace={result.trace} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </TableRow>
  )
}

function ExecutionTimeline({ trace }: { trace: NonNullable<DetailedResult["trace"]> }) {
  const [showTimeline, setShowTimeline] = useState(false)
  const [openSteps, setOpenSteps] = useState<Record<number, boolean>>({})

  const toggleStep = (idx: number) => {
    setOpenSteps((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  const filteredTrace = (trace || []).filter((s) => s.step_type !== "system_prompt")

  if (!filteredTrace || filteredTrace.length === 0) return null

  return (
    <div className="flex flex-col gap-3 mt-4 border-t pt-4">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase flex items-center gap-2">
          <Activity className="size-4 text-primary" /> Execution Trace ({filteredTrace.length} step{filteredTrace.length === 1 ? "" : "s"})
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowTimeline(!showTimeline)}
          className="text-xs gap-1.5 h-8 font-medium"
        >
          <Activity className="size-3.5 text-blue-500" />
          {showTimeline ? "Hide Timeline" : "Show Timeline"}
        </Button>
      </div>

      {showTimeline && (
        <div className="relative pl-6 pt-2 pb-2 space-y-4 before:absolute before:left-2.5 before:top-4 before:bottom-4 before:w-0.5 before:bg-blue-600">
          {filteredTrace.map((step, idx) => {
            let Icon = Bot
            let title = "AI Execution Step"
            let nodeColor = "bg-blue-600 border-blue-400 text-white"
            let badgeBg = "bg-blue-500/10 text-blue-400 border-blue-500/20"

            if (step.step_type === "user_input") {
              Icon = User
              title = "User Input"
              nodeColor = "bg-blue-500 border-blue-300"
              badgeBg = "bg-blue-500/10 text-blue-400 border-blue-500/20"
            } else if (step.step_type === "ai_tool_call") {
              Icon = Wrench
              title = "AI Tool Call"
              nodeColor = "bg-amber-500 border-amber-300"
              badgeBg = "bg-amber-500/10 text-amber-400 border-amber-500/20"
            } else if (step.step_type === "tool_result") {
              Icon = Wrench
              title = `Tool Result: ${step.tool_name}`
              nodeColor = "bg-emerald-500 border-emerald-300"
              badgeBg = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            } else if (step.step_type === "ai_answer") {
              Icon = Bot
              title = "AI Final Answer"
              nodeColor = "bg-purple-500 border-purple-300"
              badgeBg = "bg-purple-500/10 text-purple-400 border-purple-500/20"
            } else if (step.step_type === "system_prompt") {
              Icon = Clock
              title = "System Evaluation Step"
              nodeColor = "bg-slate-500 border-slate-300"
              badgeBg = "bg-slate-500/10 text-slate-400 border-slate-500/20"
            }

            const isOpen = !!openSteps[idx]

            return (
              <div key={idx} className="relative group">
                {/* Timeline node circle */}
                <div
                  className={`absolute -left-6 top-2.5 size-5 rounded-full border-2 ${nodeColor} flex items-center justify-center shadow-md z-10`}
                >
                  <div className="size-1.5 rounded-full bg-white" />
                </div>

                {/* Card Content */}
                <div className="flex flex-col rounded-lg border bg-card/60 shadow-sm overflow-hidden transition-all">
                  {/* Clickable Header */}
                  <div
                    onClick={() => toggleStep(idx)}
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-accent/50 select-none transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isOpen ? (
                        <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                      )}
                      <Badge variant="outline" className={`text-xs font-mono px-2 py-0.5 flex items-center gap-1.5 ${badgeBg}`}>
                        <Icon className="size-3" />
                        {title}
                      </Badge>
                    </div>

                    {(step.total_tokens ?? 0) > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono bg-muted/60 px-2 py-0.5 rounded border">
                        <Zap className="size-2.5 text-yellow-500" />
                        <span>{step.prompt_tokens} in</span>
                        <span className="text-muted-foreground/30">|</span>
                        <span>{step.completion_tokens} out</span>
                      </div>
                    )}
                  </div>

                  {/* Collapsible Details */}
                  {isOpen && (
                    <div className="p-3 pt-0 border-t bg-muted/20 text-xs flex flex-col gap-2">
                      {step.tool_calls && step.tool_calls.length > 0 ? (
                        <div className="flex flex-col gap-1.5 mt-2">
                          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                            Tool Arguments
                          </span>
                          {step.tool_calls.map((tc, tcIdx) => (
                            <div key={tcIdx} className="bg-background/80 rounded p-2.5 font-mono break-all border">
                              <span className="font-semibold text-amber-500">{tc.name}</span>
                              <div className="mt-1 text-muted-foreground whitespace-pre-wrap">{tc.arguments}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 text-sm whitespace-pre-wrap break-words font-mono bg-background/50 p-2.5 rounded border text-foreground/90">
                          {step.content ?? "—"}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


function DetailField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
        {label}
      </span>
      <div className="bg-muted/50 max-h-64 overflow-y-auto rounded-md p-3 text-sm whitespace-pre-wrap break-words">
        {children}
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5 py-5">
        <span className="text-muted-foreground text-xs tracking-wider uppercase">
          {label}
        </span>
        {children}
      </CardContent>
    </Card>
  )
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs tracking-wider uppercase">{label}</span>
      <span>{children}</span>
    </div>
  )
}
