import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowRight, CheckIcon, Copy, Edit, Loader2, Play, Plus, Save, Settings, SlidersHorizontal, Trash2, Sparkles, Wrench, XCircle } from "lucide-react"

import { toast } from "sonner"

import {
  evaluationConfigsApi,
  evaluationPromptsApi,
  evaluationsApi,
  llmModelsApi,
  projectToolsApi,
  providersApi,
  systemPromptsApi,
  testCasesApi,
} from "@/api"
import type {
  EvaluationConfig,
  EvaluationPrompt,
  EvaluationRun,
  LLMModel,
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
  cancelled: "destructive",
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
  const [configs, setConfigs] = useState<EvaluationConfig[]>([])
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)
  const [presetsManagerOpen, setPresetsManagerOpen] = useState(false)
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<EvaluationConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteConfigId, setDeleteConfigId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deletingConfig, setDeletingConfig] = useState(false)

  const [sysPrompts, setSysPrompts] = useState<SystemPrompt[]>([])
  const [evalPrompts, setEvalPrompts] = useState<EvaluationPrompt[]>([])
  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [llmModels, setLlmModels] = useState<LLMModel[]>([])
  const [testCases, setTestCases] = useState<TestCase[]>([])
  const [disabledTc, setDisabledTc] = useState<Set<string>>(new Set())
  const [projectTools, setProjectTools] = useState<Tool[]>([])
  const [blacklistedTools, setBlacklistedTools] = useState<Set<string>>(new Set())

  // Run form state
  const [selectedConfigId, setSelectedConfigId] = useState<string>("")
  const [systemPromptId, setSystemPromptId] = useState("")
  const [evaluationPromptId, setEvaluationPromptId] = useState("")
  const [targetProviderId, setTargetProviderId] = useState("")
  const [targetModel, setTargetModel] = useState("")
  const [evaluatorProviderId, setEvaluatorProviderId] = useState("")
  const [evaluatorModel, setEvaluatorModel] = useState("")
  const [threshold, setThreshold] = useState("0.8")
  const [enableMemory, setEnableMemory] = useState(false)

  // Advanced settings state
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [temperature, setTemperature] = useState<string>("")
  const [topP, setTopP] = useState<string>("")
  const [topK, setTopK] = useState<string>("")
  const [maxTokens, setMaxTokens] = useState<string>("")

  // Save new preset config form state
  const [configName, setConfigName] = useState("")
  const [configDesc, setConfigDesc] = useState("")

  const load = async () => {
    setError(false)
    try {
      setRuns(null)
      const [runsData, configsData] = await Promise.all([
        evaluationsApi.list(projectId),
        evaluationConfigsApi.list(projectId),
      ])
      setRuns(runsData)
      setConfigs(configsData)
    } catch (err) {
      setError(true)
      toast.error(err instanceof Error ? err.message : "Failed to load")
    }
  }

  const loadFormOptions = async () => {
    try {
      const [sp, ep, pv, lm, tc, pt, cfgs] = await Promise.all([
        systemPromptsApi.list(projectId),
        evaluationPromptsApi.list(projectId),
        providersApi.list(),
        llmModelsApi.list(),
        testCasesApi.list(projectId),
        projectToolsApi.list(projectId),
        evaluationConfigsApi.list(projectId),
      ])
      setSysPrompts(sp)
      setEvalPrompts(ep)
      setProviders(pv)
      setLlmModels(lm)
      setTestCases(tc)
      setProjectTools(pt)
      setConfigs(cfgs)
      setDisabledTc(new Set())
      setBlacklistedTools(new Set())

      if (cfgs.length > 0) {
        applyConfig(cfgs[0])
      } else {
        if (sp.length > 0) setSystemPromptId(sp[0].id)
        if (ep.length > 0) setEvaluationPromptId(ep[0].id)
        if (pv.length > 0) {
          setTargetProviderId(pv[0].id)
          setEvaluatorProviderId(pv[0].id)
          const targetMatched = lm.filter((m) => m.provider_id === pv[0].id)
          if (targetMatched.length > 0) {
            setTargetModel(targetMatched[0].model)
            setEvaluatorModel(targetMatched[0].model)
          } else {
            setTargetModel("")
            setEvaluatorModel("")
          }
        }
      }
    } catch {
      // ignore
    }
  }

  const applyConfig = (cfg: EvaluationConfig) => {
    setSelectedConfigId(cfg.id)
    setSystemPromptId(cfg.system_prompt_id || "")
    setEvaluationPromptId(cfg.evaluation_prompt_id || "")
    setTargetProviderId(cfg.target_provider_id || "")
    setTargetModel(cfg.target_model || "")
    setEvaluatorProviderId(cfg.evaluator_provider_id || "")
    setEvaluatorModel(cfg.evaluator_model || "")
    setThreshold(cfg.pass_threshold ? cfg.pass_threshold.toString() : "0.8")
    if (cfg.advanced_settings) {
      setShowAdvanced(true)
      setTemperature(cfg.advanced_settings.temperature !== undefined ? String(cfg.advanced_settings.temperature) : "")
      setTopP(cfg.advanced_settings.top_p !== undefined ? String(cfg.advanced_settings.top_p) : "")
      setTopK(cfg.advanced_settings.top_k !== undefined ? String(cfg.advanced_settings.top_k) : "")
      setMaxTokens(cfg.advanced_settings.max_tokens !== undefined ? String(cfg.advanced_settings.max_tokens) : "")
    } else {
      setShowAdvanced(false)
      setTemperature("")
      setTopP("")
      setTopK("")
      setMaxTokens("")
    }
  }

  const loadFromRun = (run: EvaluationRun) => {
    setSelectedConfigId("")
    setSystemPromptId(run.system_prompt_id || "")
    setEvaluationPromptId(run.evaluation_prompt_id || "")
    setTargetProviderId(run.target_provider_id || "")
    setTargetModel(run.target_model || "")
    setEvaluatorProviderId(run.evaluator_provider_id || "")
    setEvaluatorModel(run.evaluator_model || "")
    setThreshold(run.pass_threshold ? run.pass_threshold.toString() : "0.8")
    setEnableMemory(run.enable_memory || false)
    if (run.advanced_settings) {
      setShowAdvanced(true)
      setTemperature(run.advanced_settings.temperature !== undefined ? String(run.advanced_settings.temperature) : "")
      setTopP(run.advanced_settings.top_p !== undefined ? String(run.advanced_settings.top_p) : "")
      setTopK(run.advanced_settings.top_k !== undefined ? String(run.advanced_settings.top_k) : "")
      setMaxTokens(run.advanced_settings.max_tokens !== undefined ? String(run.advanced_settings.max_tokens) : "")
    } else {
      setShowAdvanced(false)
      setTemperature("")
      setTopP("")
      setTopK("")
      setMaxTokens("")
    }
    if (run.blacklisted_test_case_ids) {
      setDisabledTc(new Set(run.blacklisted_test_case_ids))
    }
    if (run.blacklisted_tool_ids) {
      setBlacklistedTools(new Set(run.blacklisted_tool_ids))
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
      const advPayload = showAdvanced
        ? {
            temperature: temperature !== "" ? Number.parseFloat(temperature) : undefined,
            top_p: topP !== "" ? Number.parseFloat(topP) : undefined,
            top_k: topK !== "" ? Number.parseInt(topK) : undefined,
            max_tokens: maxTokens !== "" ? Number.parseInt(maxTokens) : undefined,
          }
        : undefined

      await evaluationsApi.create(projectId, {
        config_id: selectedConfigId || undefined,
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
        advanced_settings: advPayload,
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

  const handleSaveConfig = async () => {
    if (!configName.trim()) {
      toast.error("Config name is required")
      return
    }
    setSavingConfig(true)
    try {
      const advPayload = showAdvanced
        ? {
            temperature: temperature !== "" ? Number.parseFloat(temperature) : undefined,
            top_p: topP !== "" ? Number.parseFloat(topP) : undefined,
            top_k: topK !== "" ? Number.parseInt(topK) : undefined,
            max_tokens: maxTokens !== "" ? Number.parseInt(maxTokens) : undefined,
          }
        : undefined

      const payload = {
        name: configName.trim(),
        description: configDesc.trim(),
        system_prompt_id: systemPromptId,
        evaluation_prompt_id: evaluationPromptId,
        target_provider_id: targetProviderId,
        target_model: targetModel.trim(),
        evaluator_provider_id: evaluatorProviderId,
        evaluator_model: evaluatorModel.trim(),
        pass_threshold: Number.parseFloat(threshold) || 0.8,
        advanced_settings: advPayload,
      }
      if (editingConfig) {
        await evaluationConfigsApi.update(projectId, editingConfig.id, payload)
        toast.success("Configuration updated")
      } else {
        await evaluationConfigsApi.create(projectId, payload)
        toast.success("Configuration saved as preset")
      }
      setConfigModalOpen(false)
      setConfigName("")
      setConfigDesc("")
      setEditingConfig(null)
      const cfgs = await evaluationConfigsApi.list(projectId)
      setConfigs(cfgs)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save configuration")
    } finally {
      setSavingConfig(false)
    }
  }

  const handleDeleteConfig = async () => {
    if (!deleteConfigId) return
    try {
      setDeletingConfig(true)
      await evaluationConfigsApi.remove(projectId, deleteConfigId)
      toast.success("Configuration deleted")
      setDeleteConfigId(null)
      const cfgs = await evaluationConfigsApi.list(projectId)
      setConfigs(cfgs)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete configuration")
    } finally {
      setDeletingConfig(false)
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



  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-medium text-base sm:text-lg">Evaluation runs</h3>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Configuration-based evaluation pipeline. Select a preset to run an evaluation.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="text-xs px-2.5 sm:px-3"
            onClick={async () => {
              await loadFormOptions()
              setPresetsManagerOpen(true)
            }}
          >
            <Settings className="size-3.5 sm:size-4 mr-1" />
            Presets ({configs.length})
          </Button>
          <Button size="sm" className="text-xs px-2.5 sm:px-3" onClick={openDialog}>
            <Play className="size-3.5 sm:size-4 mr-1" />
            New Run
          </Button>
        </div>
      </div>

      {/* Start Evaluation Run Dialog (Strictly Preset Selection + Runtime options) */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-w-[95vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Start evaluation run</DialogTitle>
            <DialogDescription>
              Select an existing configuration preset to run.
            </DialogDescription>
          </DialogHeader>
          {configs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-6 text-center text-sm">
              <p className="text-muted-foreground">
                No evaluation presets available. You must create an evaluation preset first before starting a run.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setOpen(false)
                  setEditingConfig(null)
                  setConfigName("")
                  setConfigDesc("")
                  setConfigModalOpen(true)
                }}
              >
                <Plus className="size-4 mr-1" /> Create Preset Now
              </Button>
            </div>
          ) : (
            <div className="flex w-full min-w-0 flex-col gap-4">
              <FormField label="Select Configuration Preset">
                <Select
                  value={selectedConfigId}
                  onValueChange={(val) => {
                    const matched = configs.find((c) => c.id === val)
                    if (matched) applyConfig(matched)
                  }}
                >
                  <SelectTrigger className="w-full font-medium border-primary/40 bg-accent/20">
                    <SelectValue placeholder="Select preset config..." />
                  </SelectTrigger>
                  <SelectContent>
                    {configs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.target_model} vs {c.evaluator_model})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              {/* Readonly details summary of the selected preset */}
              {selectedConfigId ? (
                <div className="rounded-md border bg-muted/30 p-3 text-xs flex flex-col gap-2">
                  <div className="font-semibold text-muted-foreground uppercase text-[10px]">Preset Parameters (Read-only)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div><span className="text-muted-foreground">System Prompt:</span> v{sysPrompts.find(s => s.id === systemPromptId)?.version || systemPromptId}</div>
                    <div><span className="text-muted-foreground">Evaluation Prompt:</span> v{evalPrompts.find(e => e.id === evaluationPromptId)?.version || evaluationPromptId}</div>
                    <div className="truncate"><span className="text-muted-foreground">Target:</span> {targetModel}</div>
                    <div className="truncate"><span className="text-muted-foreground">Evaluator:</span> {evaluatorModel}</div>
                    <div><span className="text-muted-foreground">Threshold:</span> {threshold}</div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Please select a preset above to load configuration parameters.</p>
              )}

              <FormField label="Enable memory">
                <div className="flex items-center gap-2 pt-1">
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
                  <span className="text-sm text-muted-foreground font-medium">
                    {enableMemory ? "ON" : "OFF"}
                  </span>
                </div>
              </FormField>

              {/* Dynamic Run Inputs: Test Cases & Active Tools */}
              <div className="flex w-full min-w-0 flex-col gap-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Label>Active Test Cases</Label>
                  <span className="text-muted-foreground text-xs">
                    {testCases.length - disabledTc.size} of {testCases.length}{" "}
                    enabled
                  </span>
                </div>
                <div className="flex max-h-48 w-full min-w-0 flex-col gap-1.5 overflow-y-auto">
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
              </div>

              {projectTools.length > 0 && (
                <div className="flex w-full min-w-0 flex-col gap-2 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5">
                      <Wrench className="size-3.5 text-primary" /> Active Tools
                    </Label>
                    <span className="text-muted-foreground text-xs">
                      {projectTools.length - blacklistedTools.size} of {projectTools.length} enabled
                    </span>
                  </div>
                  <div className="flex max-h-36 w-full min-w-0 flex-col gap-1.5 overflow-y-auto">
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
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={saving || !selectedConfigId}>
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

      {/* Presets Manager Popup Dialog */}
      <Dialog open={presetsManagerOpen} onOpenChange={setPresetsManagerOpen}>
        <DialogContent className="sm:max-w-2xl max-w-[95vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="pr-4 sm:pr-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Settings className="size-5 text-primary" />
                Evaluation Presets
              </DialogTitle>
              <Button
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => {
                  setEditingConfig(null)
                  setConfigName("")
                  setConfigDesc("")
                  setConfigModalOpen(true)
                }}
              >
                <Plus className="size-4 mr-1" /> Create Preset
              </Button>
            </div>
            <DialogDescription className="text-xs sm:text-sm">
              Manage, edit, and create reusable evaluation configuration presets.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2 max-h-[55vh] overflow-y-auto">
            {configs.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-xs sm:text-sm text-muted-foreground">
                No evaluation presets found. Click "Create Preset" above to configure your first evaluation setup.
              </div>
            ) : (
              configs.map((cfg) => (
                <div
                  key={cfg.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3 sm:p-4 bg-card shadow-2xs hover:border-primary/40 transition-colors"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="font-semibold text-xs sm:text-sm truncate">{cfg.name}</span>
                    {cfg.description && (
                      <span className="text-[11px] sm:text-xs text-muted-foreground truncate">{cfg.description}</span>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] text-muted-foreground">
                      <Badge variant="outline" className="text-[10px] max-w-[140px] truncate">
                        Target: {cfg.target_model}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] max-w-[140px] truncate">
                        Evaluator: {cfg.evaluator_model}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        Threshold: {cfg.pass_threshold}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        applyConfig(cfg)
                        setPresetsManagerOpen(false)
                        setOpen(true)
                      }}
                    >
                      <Play className="size-3.5 mr-1" /> Run
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      onClick={() => {
                        applyConfig(cfg)
                        setEditingConfig(cfg)
                        setConfigName(cfg.name)
                        setConfigDesc(cfg.description || "")
                        setConfigModalOpen(true)
                      }}
                      title="Edit Preset"
                    >
                      <Edit className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteConfigId(cfg.id)}
                      title="Delete Preset"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPresetsManagerOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save / Edit Preset Config Modal */}
      <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
        <DialogContent className="sm:max-w-xl max-w-[95vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{editingConfig ? "Edit Configuration Preset" : "Create Configuration Preset"}</DialogTitle>
            <DialogDescription>
              {editingConfig ? "Modify and save changes to this configuration preset." : "Save a reusable preset configuration for your evaluation pipeline."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Preset Name">
                <Input
                  placeholder="e.g. GPT-4o Standard Benchmark"
                  value={configName}
                  onChange={(e) => setConfigName(e.target.value)}
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
            </div>
            <FormField label="Description (Optional)">
              <Input
                placeholder="e.g. Main system prompt v1 with 0.8 pass threshold"
                value={configDesc}
                onChange={(e) => setConfigDesc(e.target.value)}
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="System prompt">
                <Select value={systemPromptId} onValueChange={setSystemPromptId}>
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
                <Select value={evaluationPromptId} onValueChange={setEvaluationPromptId}>
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Target provider">
                <Select
                  value={targetProviderId}
                  onValueChange={(val) => {
                    setTargetProviderId(val)
                    const matched = llmModels.filter((m) => m.provider_id === val)
                    if (matched.length > 0) setTargetModel(matched[0].model)
                    else setTargetModel("")
                  }}
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
                {(() => {
                  const availableModels = llmModels.filter((m) => m.provider_id === targetProviderId)
                  if (availableModels.length === 0) {
                    return (
                      <Input
                        value={targetModel}
                        onChange={(e) => setTargetModel(e.target.value)}
                        placeholder="e.g. gpt-4o-mini"
                      />
                    )
                  }
                  return (
                    <Select value={targetModel} onValueChange={setTargetModel}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels.map((m) => (
                          <SelectItem key={m.id} value={m.model}>
                            {m.title} ({m.model})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )
                })()}
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Evaluator provider">
                <Select
                  value={evaluatorProviderId}
                  onValueChange={(val) => {
                    setEvaluatorProviderId(val)
                    const matched = llmModels.filter((m) => m.provider_id === val)
                    if (matched.length > 0) setEvaluatorModel(matched[0].model)
                    else setEvaluatorModel("")
                  }}
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
                {(() => {
                  const availableModels = llmModels.filter((m) => m.provider_id === evaluatorProviderId)
                  if (availableModels.length === 0) {
                    return (
                      <Input
                        value={evaluatorModel}
                        onChange={(e) => setEvaluatorModel(e.target.value)}
                        placeholder="e.g. gpt-4o"
                      />
                    )
                  }
                  return (
                    <Select value={evaluatorModel} onValueChange={setEvaluatorModel}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels.map((m) => (
                          <SelectItem key={m.id} value={m.model}>
                            {m.title} ({m.model})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )
                })()}
              </FormField>
            </div>

            <div className="rounded-lg border bg-card p-3 space-y-3">
              <button
                type="button"
                className="flex items-center justify-between w-full text-xs font-semibold text-foreground hover:text-primary transition-colors"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <span className="flex items-center gap-1.5">
                  <SlidersHorizontal className="size-3.5 text-primary" /> Advanced Settings (Core Behavioral Parameters)
                </span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  {showAdvanced ? "Hide" : "Show"}
                </span>
              </button>
              {showAdvanced && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <FormField label="Temperature">
                    <Input
                      type="number"
                      min={0}
                      max={2}
                      step={0.1}
                      placeholder="e.g. 0.7"
                      value={temperature}
                      onChange={(e) => setTemperature(e.target.value)}
                    />
                  </FormField>
                  <FormField label="Top P">
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      placeholder="e.g. 0.9"
                      value={topP}
                      onChange={(e) => setTopP(e.target.value)}
                    />
                  </FormField>
                  <FormField label="Top K">
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      placeholder="e.g. 40"
                      value={topK}
                      onChange={(e) => setTopK(e.target.value)}
                    />
                  </FormField>
                  <FormField label="Max Tokens">
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      placeholder="e.g. 2048"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(e.target.value)}
                    />
                  </FormField>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfigModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveConfig} disabled={savingConfig}>
              {savingConfig ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4 mr-1" />}
              {editingConfig ? "Save Changes" : "Save Preset"}
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
            {runs.map((run) => {
              const preset = configs.find((c) => c.id === run.config_id)
              const titleText = preset ? preset.name : `${run.target_model} vs ${run.evaluator_model}`

              return (
                <Card
                  key={run.id}
                  className="hover:border-primary/40 group cursor-pointer transition-all"
                  onClick={() =>
                    navigate(`/projects/${projectId}/evaluations/${run.id}`)
                  }
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col min-w-0">
                        <CardTitle className="text-sm font-semibold truncate">
                          {titleText}
                        </CardTitle>
                        <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                          <span><strong className="font-medium text-foreground/80">target:</strong> {run.target_model}</span>
                          <span><strong className="font-medium text-foreground/80">evaluator:</strong> {run.evaluator_model}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                    {(run.status === "completed" || run.status === "failed") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-primary gap-1"
                        onClick={async (e) => {
                          e.stopPropagation()
                          await loadFormOptions()
                          loadFromRun(run)
                          setOpen(true)
                        }}
                        title="Re-run evaluation using this run's configuration"
                      >
                        <Copy className="size-3.5" /> Re-run
                      </Button>
                    )}
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
            )
          })}
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

      <ConfirmDialog
        open={deleteConfigId !== null}
        onOpenChange={(o) => !o && setDeleteConfigId(null)}
        title="Delete preset configuration?"
        description="This permanently deletes the saved evaluation configuration. This cannot be undone."
        confirmLabel="Delete config"
        destructive
        loading={deletingConfig}
        onConfirm={handleDeleteConfig}
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
