import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import type { EvaluationRun } from "@/api/types"
import { formatDateTime } from "@/lib/utils"

interface ComparisonChartProps {
  runs: EvaluationRun[]
}

export function ComparisonChart({ runs }: ComparisonChartProps) {
  const chartData = runs
    .filter(run => run.status === "completed")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map(run => ({
      name: run.model_used,
      score: run.average_score || 0,
      passed: run.is_passed ? 1 : 0,
      timestamp: formatDateTime(run.created_at),
    }))

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-muted-foreground">
          No completed evaluations to display
        </div>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart
        data={chartData}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="name"
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 1]}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => value.toFixed(1)}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            color: "hsl(var(--foreground))",
          }}
          itemStyle={{ color: "hsl(var(--primary))" }}
          formatter={(value: any, name: any) => [value?.toFixed(2) ?? "0.00", name]}
          labelFormatter={(name: any) => `Model: ${name}`}
        />
        <Legend
          wrapperStyle={{
            color: "hsl(var(--foreground))",
            fontSize: 12,
          }}
        />
        <Bar
          dataKey="score"
          name="Average Score"
          fill="hsl(var(--primary))"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="passed"
          name="Passed"
          fill="hsl(var(--success))"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}