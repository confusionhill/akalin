import { useState, useEffect, useRef } from "react"
import { Loader2, Settings2, Upload, Download, Plus, Trash2, SlidersHorizontal } from "lucide-react"
import { toast } from "sonner"
import Papa from "papaparse"

import { rubricDraftsApi, providersApi, llmModelsApi } from "@/api"
import type { ProviderConfig, SystemPrompt, RubricTrainingRow, LLMModel } from "@/api/types"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"

interface CalibrateRubricModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  prompts: SystemPrompt[]
  onSuccess?: () => void
}

export function CalibrateRubricModal({
  open,
  onOpenChange,
  projectId,
  prompts,
  onSuccess,
}: CalibrateRubricModalProps) {
  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [llmModels, setLlmModels] = useState<LLMModel[]>([])

  const [providerId, setProviderId] = useState("")
  const [model, setModel] = useState("")
  const [basePromptId, setBasePromptId] = useState<string>("none")
  const [customInstructions, setCustomInstructions] = useState("")

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [temperature, setTemperature] = useState<string>("")
  const [topP, setTopP] = useState<string>("")
  const [topK, setTopK] = useState<string>("")
  const [maxTokens, setMaxTokens] = useState<string>("")

  const [rows, setRows] = useState<RubricTrainingRow[]>([])
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch providers and models
  useEffect(() => {
    if (open) {
      Promise.all([providersApi.list(), llmModelsApi.list()])
        .then(([provData, modelData]) => {
          setProviders(provData)
          setLlmModels(modelData)
          if (provData.length > 0) {
            const initialProvId = providerId || provData[0].id
            setProviderId(initialProvId)
            const matched = modelData.filter((m) => m.provider_id === initialProvId)
            if (matched.length > 0) {
              setModel(matched[0].model)
            } else if (!model) {
              setModel("")
            }
          }
        })
        .catch(() => toast.error("Failed to load providers or models"))
    }
  }, [open])

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setCustomInstructions("")
      setRows([])
      setLoading(false)
      if (prompts.length > 0) {
        setBasePromptId(prompts[0].id)
      } else {
        setBasePromptId("none")
      }
    }
  }, [open, prompts])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedRows: RubricTrainingRow[] = []
        for (const row of results.data as any) {
          parsedRows.push({
            input: row.input || row.Input || "",
            expected_output: row.expected_output || row.Expected_Output || "",
            actual_output: row.actual_output || row.Actual_Output || "",
            score: row.score || row.Score || "",
            reasoning: row.reasoning || row.Reasoning || ""
          })
        }
        if (parsedRows.length === 0) {
          toast.error("No valid rows found in CSV. Make sure you have the correct headers.")
          return
        }
        setRows(prev => [...prev, ...parsedRows].slice(0, 100))
        if (fileInputRef.current) fileInputRef.current.value = ""
        toast.success(`Imported ${parsedRows.length} rows`)
      },
      error: () => toast.error("Failed to parse CSV")
    })
  }

  const addRow = () => {
    if (rows.length >= 100) {
      toast.error("Maximum 100 rows allowed")
      return
    }
    setRows([...rows, { input: "", expected_output: "", actual_output: "", score: "", reasoning: "" }])
  }

  const updateRow = (index: number, field: keyof RubricTrainingRow, value: string) => {
    const newRows = [...rows]
    newRows[index] = { ...newRows[index], [field]: value }
    setRows(newRows)
  }

  const removeRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index))
  }

  const handleStart = async () => {
    if (rows.length === 0) {
      toast.error("Please add at least one row of training data")
      return
    }
    if (!providerId) {
      toast.error("Please select a provider")
      return
    }

    setLoading(true)
    try {
      const advPayload = showAdvanced
        ? {
            temperature: temperature !== "" ? Number.parseFloat(temperature) : undefined,
            top_p: topP !== "" ? Number.parseFloat(topP) : undefined,
            top_k: topK !== "" ? Number.parseInt(topK) : undefined,
            max_tokens: maxTokens !== "" ? Number.parseInt(maxTokens) : undefined,
          }
        : undefined

      await rubricDraftsApi.calibrate(projectId, {
        provider_id: providerId,
        model: model,
        base_prompt_id: basePromptId === "none" ? undefined : basePromptId,
        custom_instructions: customInstructions,
        rows: rows,
        advanced_settings: advPayload,
      })
      toast.success("Calibration started")
      if (onSuccess) onSuccess()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start calibration")
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    window.location.href = `/api/rubric-template.csv`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="size-5 text-indigo-500" />
            Calibrate Rubric
          </DialogTitle>
          <DialogDescription>
            Provide baseline examples to auto-generate a custom evaluation rubric.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="basePrompt">Base Rubric (Optional)</Label>
              <Select value={basePromptId} onValueChange={setBasePromptId}>
                <SelectTrigger id="basePrompt">
                  <SelectValue placeholder="Select prompt" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Generate from scratch)</SelectItem>
                  {prompts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      v{p.version} ({p.content.slice(0, 30)}...)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="provider">Meta-LLM Provider</Label>
              <Select
                value={providerId}
                onValueChange={(val) => {
                  setProviderId(val)
                  const matched = llmModels.filter((m) => m.provider_id === val)
                  if (matched.length > 0) setModel(matched[0].model)
                  else setModel("")
                }}
              >
                <SelectTrigger id="provider">
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
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="model">Meta-LLM Model</Label>
              {(() => {
                const availableModels = llmModels.filter(
                  (m) => m.provider_id === providerId
                )
                if (availableModels.length === 0) {
                  return (
                    <Input
                      id="model"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="e.g. gpt-4o (or add model in Models tab)"
                    />
                  )
                }
                return (
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger id="model">
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
            </div>
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
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Temperature</Label>
                  <Input
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    placeholder="e.g. 0.2"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Top P</Label>
                  <Input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    placeholder="e.g. 0.9"
                    value={topP}
                    onChange={(e) => setTopP(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Top K</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="e.g. 40"
                    value={topK}
                    onChange={(e) => setTopK(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Max Tokens</Label>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    placeholder="e.g. 2048"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="customInstructions">Custom Instructions (Optional)</Label>
            <Textarea
              id="customInstructions"
              placeholder="e.g. Keep the rubric concise, focus on tonal issues..."
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex flex-col gap-2 flex-1 overflow-hidden min-h-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <Label>Training Data ({rows.length}/100)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept=".csv"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 size-4" />
                  Import CSV
                </Button>
                <Button variant="secondary" size="sm" onClick={downloadTemplate} title="Download Template">
                  <Download className="mr-2 size-4" />
                  Template
                </Button>
                <Button variant="default" size="sm" onClick={addRow}>
                  <Plus className="mr-2 size-4" />
                  Add Row
                </Button>
              </div>
            </div>

            <div className="border rounded-md flex-1 overflow-y-auto min-h-0">
              <div className="min-w-[800px] p-4">
                {rows.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm flex flex-col items-center">
                    <Settings2 className="size-10 mb-3 text-muted-foreground/30" />
                    <p>No training data yet.</p>
                    <p>Import a CSV or add a row manually to begin.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {rows.map((row, idx) => (
                      <div key={idx} className="relative border rounded-md p-4 bg-muted/20">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                          onClick={() => removeRow(idx)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                        <div className="grid grid-cols-2 gap-4 mr-8">
                          <div className="flex flex-col gap-1.5">
                            <Label className="text-xs text-muted-foreground">Input</Label>
                            <Textarea className="text-xs min-h-[60px]" value={row.input} onChange={(e) => updateRow(idx, 'input', e.target.value)} />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label className="text-xs text-muted-foreground">Expected Output</Label>
                            <Textarea className="text-xs min-h-[60px]" value={row.expected_output} onChange={(e) => updateRow(idx, 'expected_output', e.target.value)} />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label className="text-xs text-muted-foreground">Actual Output</Label>
                            <Textarea className="text-xs min-h-[60px]" value={row.actual_output} onChange={(e) => updateRow(idx, 'actual_output', e.target.value)} />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label className="text-xs text-muted-foreground">Reasoning</Label>
                            <Textarea className="text-xs min-h-[60px]" value={row.reasoning} onChange={(e) => updateRow(idx, 'reasoning', e.target.value)} />
                          </div>
                          <div className="col-span-2 flex flex-col gap-1.5 w-1/2">
                            <Label className="text-xs text-muted-foreground">Score</Label>
                            <Input className="text-xs" value={row.score} onChange={(e) => updateRow(idx, 'score', e.target.value)} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t mt-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleStart} disabled={loading || rows.length === 0 || !providerId}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Calibrate Rubric
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
