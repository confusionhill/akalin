export interface AuthResponse {
  id: string
  tenant_id: string
  email: string
  handle: string
  full_name: string
  token: string
}

export interface Tenant {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  tenant_id: string
  name: string
  description: string
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
}

export interface SystemPrompt {
  id: string
  project_id: string
  content: string
  version: number
  created_by: string
  created_at: string
}

export interface EvaluationPrompt {
  id: string
  project_id: string
  content: string
  version: number
  created_by: string
  created_at: string
}

export interface TestCase {
  id: string
  project_id: string
  input_prompt: string
  expected_output: string
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
}

export type HeadersMap = Record<string, string>

export interface ProviderConfig {
  id: string
  tenant_id: string
  name: string
  base_url: string
  api_key: string
  custom_headers: HeadersMap
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
}

export interface Tool {
  id: string
  tenant_id: string
  name: string
  description: string
  result: string
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
}

export type RunStatus = "pending" | "running" | "completed" | "failed"

export interface EvaluationRun {
  id: string
  project_id: string
  system_prompt_id: string
  evaluation_prompt_id: string
  target_provider_id: string
  target_model: string
  evaluator_provider_id: string
  evaluator_model: string
  model_used: string
  status: RunStatus
  pass_threshold: number
  is_passed: boolean | null
  average_score: number | null
  failure_reason: string | null
  blacklisted_test_case_ids: string[]
  blacklisted_tool_ids: string[]
  enable_memory: boolean
  run_by: string
  created_at: string
  completed_at: string | null
}

export interface EvaluationResult {
  id: string
  run_id: string
  test_case_id: string
  generated_output: string | null
  score: number | null
  is_passed: boolean | null
  evaluator_reasoning: string | null
  tools_called: string[]
  created_at: string
}

export interface DetailedResult extends EvaluationResult {
  input_prompt: string
  expected_output: string
}

export interface RunDetails extends EvaluationRun {
  results: DetailedResult[]
}

export interface CreateProjectInput {
  name: string
  description: string
}

export interface CreateSystemPromptInput {
  content: string
}

export interface CreateEvaluationPromptInput {
  content: string
}

export interface CreateTestCaseInput {
  input_prompt: string
  expected_output: string
}

export interface CreateProviderInput {
  name: string
  base_url: string
  api_key: string
  custom_headers: HeadersMap
}

export interface CreateToolInput {
  name: string
  description: string
  result: string
}

export interface CreateEvaluationInput {
  system_prompt_id: string
  evaluation_prompt_id: string
  target_provider_id: string
  target_model: string
  evaluator_provider_id: string
  evaluator_model: string
  model_used?: string
  pass_threshold: number
  blacklisted_test_case_ids?: string[]
  blacklisted_tool_ids?: string[]
  enable_memory?: boolean
}

