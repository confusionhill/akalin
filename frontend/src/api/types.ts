export interface AuthResponse {
  id: string
  email: string
  handle: string
  full_name: string
  token: string
}

export interface SessionResponse {
  tenant_id: string
  user_id: string
  access_role: number
  token: string
}

export interface TenantUserResponse {
  user_id: string
  email: string
  handle: string
  full_name: string
  access_role: number
  joined_at: string
}

export interface TenantInvitationResponse {
  id: string
  tenant_id: string
  email: string
  access_role: number
  token: string
  expires_at: string
  created_at: string
}

export interface Tenant {
  id: string
  name: string
  master_user_id?: string
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
  traffic_weight: number
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
  expected_format?: "plain_text" | "json"
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
  parameters?: any
  result: string
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
}

export type RunStatus = "pending" | "running" | "completed" | "failed" | "cancelled"

export interface AdvancedSettings {
  temperature?: number
  top_p?: number
  top_k?: number
  max_tokens?: number
}

export interface EvaluationRun {
  id: string
  project_id: string
  config_id: string | null
  system_prompt_id: string
  evaluation_prompt_id: string
  target_provider_id: string
  target_model: string
  evaluator_provider_id: string
  evaluator_model: string
  model_used: string
  status: "pending" | "running" | "completed" | "failed" | "cancelled"
  pass_threshold: number
  is_passed: boolean | null
  average_score: number | null
  failure_reason: string | null
  blacklisted_test_case_ids: string[]
  blacklisted_tool_ids: string[]
  enable_memory: boolean
  advanced_settings?: AdvancedSettings | null
  run_by: string
  created_at: string
  completed_at: string | null
}

export interface TraceStep {
  step_type: string
  content?: string
  tool_calls?: { name: string; arguments: string }[]
  tool_name?: string
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
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
  trace?: TraceStep[]
  created_at: string
}

export interface DetailedResult extends EvaluationResult {
  input_prompt: string
  expected_output: string
  expected_format?: "plain_text" | "json"
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
  expected_format?: "plain_text" | "json"
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
  parameters?: any
  result: string
}

export interface CreateEvaluationInput {
  config_id?: string
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
  advanced_settings?: AdvancedSettings | null
}

export interface UpdateProfileInput {
  email: string
  handle: string
  full_name: string
}

export interface UpdatePasswordInput {
  current_password: string
  new_password: string
}

export interface RubricDraft {
  id: string
  project_id: string
  status: "pending" | "running" | "completed" | "failed" | "cancelled"
  draft_content: string | null
  failure_reason: string | null
  payload: any | null
  source_run_id: string | null
  base_prompt_id: string | null
  base_prompt_version: number | null
  results_analyzed: number | null
  created_by: string | null
  created_at: string
  completed_at: string | null
}

export interface RubricTrainingRow {
  input: string
  expected_output: string
  actual_output: string
  score: string
  reasoning: string
}

export interface CalibrateRubricRequest {
  provider_id: string
  model: string
  base_prompt_id?: string
  custom_instructions: string
  rows: RubricTrainingRow[]
  advanced_settings?: AdvancedSettings | null
}

export interface LLMModel {
  id: string
  tenant_id: string
  provider_id: string
  title: string
  model: string
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
}

export interface CreateLLMModelInput {
  provider_id: string
  title: string
  model: string
}

export interface TestLLMModelInput {
  provider_id: string
  model: string
}

export interface TestLLMModelResponse {
  success: boolean
  error?: string
}

export interface EvaluationConfig {
  id: string
  project_id: string
  name: string
  description: string
  system_prompt_id: string
  evaluation_prompt_id: string
  target_provider_id: string
  target_model: string
  evaluator_provider_id: string
  evaluator_model: string
  pass_threshold: number
  advanced_settings?: AdvancedSettings | null
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
}

export interface CreateEvaluationConfigInput {
  name: string
  description?: string
  system_prompt_id: string
  evaluation_prompt_id: string
  target_provider_id: string
  target_model: string
  evaluator_provider_id: string
  evaluator_model: string
  pass_threshold: number
  advanced_settings?: AdvancedSettings | null
}

export interface ModelPerformanceSummary {
  model: string
  runs: number
  averageScore: number
  bestScore: number
  worstScore: number
}

export interface APIKey {
  id: string
  user_id: string
  name: string
  key_hash: string
  last_used_at: string | null
  expires_at: string | null
  created_at: string
}

export interface CreateAPIKeyInput {
  name: string
  expires_in: string // "7-days", "30-days", "90-days", "never"
}

export interface CreateAPIKeyResponse {
  api_key: APIKey
  raw_key: string
}

export interface PromptDistribution {
  prompt_id: string
  weight: number
}

export interface PublishSystemPromptsInput {
  distributions: PromptDistribution[]
}
