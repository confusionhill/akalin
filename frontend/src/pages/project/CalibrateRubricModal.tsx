import { useState, useEffect, useRef } from "react"
import { Loader2, Settings2, Upload, Download, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import Papa from "papaparse"

import { rubricDraftsApi, providersApi } from "@/api"
import type { ProviderConfig, SystemPrompt, RubricTrainingRow } from "@/api/types"
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

  const [providerId, setProviderId] = useState("")
  const [model, setModel] = useState("gpt-4o")
  const [basePromptId, setBasePromptId] = useState<string>("none")
  const [customInstructions, setCustomInstructions] = useState("")

  const [rows, setRows] = useState<RubricTrainingRow[]>([])
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch providers
  useEffect(() => {
    if (open && providers.length === 0) {
      providersApi.list().then(data => {
        setProviders(data)
        if (data.length > 0 && !providerId) {
          setProviderId(data[0].id)
        }
      }).catch(() => toast.error("Failed to load providers"))
    }
  }, [open, providers.length, providerId])

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
      await rubricDraftsApi.calibrate(projectId, {
        provider_id: providerId,
        model: model,
        base_prompt_id: basePromptId === "none" ? undefined : basePromptId,
        custom_instructions: customInstructions,
        rows: rows
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
            Manually supply inputs, expected outputs, and scoring logic, or upload a CSV to calibrate an evaluation prompt.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-2 overflow-hidden flex-1">
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="basePrompt">Foundation Prompt</Label>
              <Select value={basePromptId} onValueChange={setBasePromptId}>
                <SelectTrigger id="basePrompt">
                  <SelectValue placeholder="Select prompt" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Start from scratch)</SelectItem>
                  {prompts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      Version {p.version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="provider">Meta-LLM Provider</Label>
              <Select value={providerId} onValueChange={setProviderId}>
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
              <Input
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. gpt-4o"
              />
            </div>
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
            <div className="flex items-center justify-between">
              <Label>Training Data ({rows.length}/100)</Label>
              <div className="flex items-center gap-2">
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
