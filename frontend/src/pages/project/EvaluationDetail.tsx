import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, CheckCircle2, Loader2, RotateCw, Trash2, XCircle } from "lucide-react"
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

const statusVariant: Record<
  RunStatus,
  "warning" | "info" | "success" | "destructive"
> = {
  pending: "warning",
  running: "info",
  completed: "success",
  failed: "destructive",
}

export function EvaluationDetailPage() {
  const { id: projectId = "", runId = "" } = useParams()
  const navigate = useNavigate()
  const [run, setRun] = useState<RunDetails | null>(null)
  const [error, setError] = useState(false)
  const [rerunning, setRerunning] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
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
        pass_threshold: run.pass_threshold,
        blacklisted_test_case_ids: run.blacklisted_test_case_ids ?? [],
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
            <SummaryCard label="Pass threshold">
              <span className="text-xl font-semibold">
                {run.pass_threshold.toFixed(2)}
              </span>
            </SummaryCard>
          </div>

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
              <CardTitle className="text-sm">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground grid gap-2 text-sm sm:grid-cols-2">
              <KV label="Target">{run.target_model}</KV>
              <KV label="Evaluator">{run.evaluator_model}</KV>
              <KV label="Started">{formatDateTime(run.created_at)}</KV>
              <KV label="Completed">{formatDateTime(run.completed_at)}</KV>
              <KV label="Excluded">
                {(run.blacklisted_test_case_ids?.length ?? 0) > 0
                  ? `${run.blacklisted_test_case_ids.length} test case${run.blacklisted_test_case_ids.length === 1 ? "" : "s"}`
                  : "None"}
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
          <p className="line-clamp-3 whitespace-normal text-xs">
            {result.generated_output}
          </p>
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
              {result.expected_output}
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
          </div>
        </DialogContent>
      </Dialog>
    </TableRow>
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
