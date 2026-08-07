import { useEffect, useState } from "react"
import { Loader2, Sparkles } from "lucide-react"

import { toast } from "sonner"

import { evaluationsApi } from "@/api"
import type { ModelPerformanceSummary } from "@/api/types"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function ModelPerformanceTab({ projectId }: { projectId: string }) {
  const [summary, setSummary] = useState<ModelPerformanceSummary[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)

    evaluationsApi
      .summary(projectId)
      .then((data) => {
        if (active) setSummary(data)
      })
      .catch((err) => {
        if (active) {
          toast.error(
            err instanceof Error ? err.message : "Failed to load model performance summary",
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [projectId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading summary...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Model Performance</h2>
          <p className="text-muted-foreground text-sm">
            Aggregate statistics of evaluated models.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="size-4" />
            Model Performance Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summary !== null && summary.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {summary.map((stat) => (
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
    </div>
  )
}
