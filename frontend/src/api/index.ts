import { http } from "./client"
import type {
  AuthResponse,
  SessionResponse,
  Tenant,
  TenantUserResponse,
  TenantInvitationResponse,
  CreateEvaluationInput,
  CreateEvaluationPromptInput,
  CreateProjectInput,
  CreateProviderInput,
  CreateSystemPromptInput,
  CreateTestCaseInput,
  CreateToolInput,
  EvaluationPrompt,
  EvaluationRun,
  Project,
  ProviderConfig,
  RunDetails,
  SystemPrompt,
  TestCase,
  Tool,
  UpdateProfileInput,
  UpdatePasswordInput,
  ModelPerformanceSummary,
  APIKey,
  CreateAPIKeyInput,
  CreateAPIKeyResponse,
  PublishSystemPromptsInput,
} from "./types"

export const authApi = {
  login: (email: string, password: string) =>
    http.post<AuthResponse>("/auth/login", { email, password }),
  register: (email: string, handle: string, full_name: string, password: string) =>
    http.post<AuthResponse>("/auth/register", { email, handle, full_name, password }),
  createTenant: (name: string) =>
    http.post<Tenant>("/auth/tenant", { name }),
  getMyTenants: () =>
    http.get<Tenant[]>("/auth/tenants"),
  switchTenant: (tenant_id: string) =>
    http.post<SessionResponse>("/auth/tenant/switch", { tenant_id }),
  getTenantUsers: () =>
    http.get<TenantUserResponse[]>("/auth/tenant/users"),
  updateTenantUserRole: (userId: string, accessRole: number) =>
    http.put<void>(`/auth/tenant/users/${userId}/role`, { access_role: accessRole }),
  removeTenantUser: (userId: string) =>
    http.del<void>(`/auth/tenant/users/${userId}`),
  createInvitation: (email: string, expires_in?: string, custom_expires_at?: string) =>
    http.post<TenantInvitationResponse>("/auth/tenant/invites", { email, expires_in, custom_expires_at }),
  joinTenant: (token: string) =>
    http.post<Tenant>("/auth/tenant/join", { token }),
}


export const usersApi = {
  updateProfile: (body: UpdateProfileInput) =>
    http.put<{ email: string; handle: string; full_name: string }>("/users/me/profile", body),
  updatePassword: (body: UpdatePasswordInput) =>
    http.put<void>("/users/me/password", body),
}

export const projectsApi = {
  list: () => http.get<Project[]>("/projects"),
  create: (body: CreateProjectInput) => http.post<Project>("/projects", body),
  get: (id: string) => http.get<Project>(`/projects/${id}`),
  update: (id: string, body: CreateProjectInput) =>
    http.put<Project>(`/projects/${id}`, body),
}

export const systemPromptsApi = {
  list: (projectId: string) =>
    http.get<SystemPrompt[]>(`/projects/${projectId}/prompts`),
  create: (projectId: string, body: CreateSystemPromptInput) =>
    http.post<SystemPrompt>(`/projects/${projectId}/prompts`, body),
  update: (projectId: string, promptId: string, body: CreateSystemPromptInput) =>
    http.put<SystemPrompt>(
      `/projects/${projectId}/prompts/${promptId}`,
      body,
    ),
  publish: (projectId: string, body: PublishSystemPromptsInput) =>
    http.post<void>(`/projects/${projectId}/prompts/publish`, body),
}

export const evaluationPromptsApi = {
  list: (projectId: string) =>
    http.get<EvaluationPrompt[]>(`/projects/${projectId}/evaluation-prompts`),
  create: (projectId: string, body: CreateEvaluationPromptInput) =>
    http.post<EvaluationPrompt>(
      `/projects/${projectId}/evaluation-prompts`,
      body,
    ),
  update: (
    projectId: string,
    promptId: string,
    body: CreateEvaluationPromptInput,
  ) =>
    http.put<EvaluationPrompt>(
      `/projects/${projectId}/evaluation-prompts/${promptId}`,
      body,
    ),
}

export const testCasesApi = {
  list: (projectId: string) =>
    http.get<TestCase[]>(`/projects/${projectId}/test-cases`),
  create: (projectId: string, body: CreateTestCaseInput) =>
    http.post<TestCase>(`/projects/${projectId}/test-cases`, body),
  update: (
    projectId: string,
    tcId: string,
    body: CreateTestCaseInput,
  ) => http.put<TestCase>(`/projects/${projectId}/test-cases/${tcId}`, body),
  remove: (projectId: string, tcId: string) =>
    http.del<void>(`/projects/${projectId}/test-cases/${tcId}`),
}

export const providersApi = {
  list: () => http.get<ProviderConfig[]>("/providers"),
  create: (body: CreateProviderInput) =>
    http.post<ProviderConfig>("/providers", body),
  update: (providerId: string, body: CreateProviderInput) =>
    http.put<ProviderConfig>(`/providers/${providerId}`, body),
  remove: (providerId: string) => http.del<void>(`/providers/${providerId}`),
}

export const toolsApi = {
  list: () => http.get<Tool[]>("/tools"),
  create: (body: CreateToolInput) => http.post<Tool>("/tools", body),
  update: (toolId: string, body: CreateToolInput) =>
    http.put<Tool>(`/tools/${toolId}`, body),
  remove: (toolId: string) => http.del<void>(`/tools/${toolId}`),
}

export const projectToolsApi = {
  list: (projectId: string) => http.get<Tool[]>(`/projects/${projectId}/tools`),
  update: (projectId: string, toolIds: string[]) =>
    http.put<Tool[]>(`/projects/${projectId}/tools`, { tool_ids: toolIds }),
}

export const evaluationsApi = {
  list: (projectId: string) =>
    http.get<EvaluationRun[]>(`/projects/${projectId}/evaluations`),
  create: (projectId: string, body: CreateEvaluationInput) =>
    http.post<EvaluationRun>(`/projects/${projectId}/evaluations`, body),
  details: (projectId: string, runId: string) =>
    http.get<RunDetails>(`/projects/${projectId}/evaluations/${runId}`),
  remove: (projectId: string, runId: string) =>
    http.del<void>(`/projects/${projectId}/evaluations/${runId}`),
  cancel: (projectId: string, runId: string) =>
    http.post<void>(`/projects/${projectId}/evaluations/${runId}/cancel`, {}),
  summary: (projectId: string) =>
    http.get<ModelPerformanceSummary[]>(`/projects/${projectId}/evaluations-summary`),
}

export const apiKeysApi = {
  list: () => http.get<APIKey[]>("/users/me/api-keys"),
  create: (body: CreateAPIKeyInput) => http.post<CreateAPIKeyResponse>("/users/me/api-keys", body),
  delete: (id: string) => http.del<void>(`/users/me/api-keys/${id}`),
}

export const evaluationConfigsApi = {
  list: (projectId: string) =>
    http.get<import("./types").EvaluationConfig[]>(`/projects/${projectId}/configs`),
  create: (projectId: string, body: import("./types").CreateEvaluationConfigInput) =>
    http.post<import("./types").EvaluationConfig>(`/projects/${projectId}/configs`, body),
  update: (projectId: string, configId: string, body: import("./types").CreateEvaluationConfigInput) =>
    http.put<import("./types").EvaluationConfig>(`/projects/${projectId}/configs/${configId}`, body),
  remove: (projectId: string, configId: string) =>
    http.del<void>(`/projects/${projectId}/configs/${configId}`),
}

export const rubricDraftsApi = {
  // Mode A: from completed run
  refineFromRun: (projectId: string, runId: string, basePromptId?: string, customInstructions?: string) =>
    http.post<{ draft_id: string }>(
      `/projects/${projectId}/evaluations/${runId}/refine-rubric`,
      { base_prompt_id: basePromptId, custom_instructions: customInstructions }
    ),

  // Mode B: from calibration UI (manual or CSV imported)
  calibrate: (projectId: string, body: import("./types").CalibrateRubricRequest) =>
    http.post<{ draft_id: string }>(
      `/projects/${projectId}/calibrate-rubric`,
      body
    ),

  // Poll draft status
  get: (projectId: string, draftId: string) =>
    http.get<import("./types").RubricDraft>(
      `/projects/${projectId}/rubric-drafts/${draftId}`
    ),

  // Cancel generation
  cancel: (projectId: string, draftId: string) =>
    http.post<void>(
      `/projects/${projectId}/rubric-drafts/${draftId}/cancel`,
      {}
    ),

  // List all drafts
  list: (projectId: string) =>
    http.get<import("./types").RubricDraft[]>(
      `/projects/${projectId}/rubric-drafts`
    ),

  // Retry failed draft
  retry: (projectId: string, draftId: string) =>
    http.post<{ draft_id: string }>(
      `/projects/${projectId}/rubric-drafts/${draftId}/retry`,
      {}
    ),

  // Delete draft
  remove: (projectId: string, draftId: string) =>
    http.del<void>(`/projects/${projectId}/rubric-drafts/${draftId}`),
}

export const llmModelsApi = {
  list: () => http.get<import("./types").LLMModel[]>("/models"),
  create: (body: import("./types").CreateLLMModelInput) =>
    http.post<import("./types").LLMModel>("/models", body),
  update: (modelId: string, body: import("./types").CreateLLMModelInput) =>
    http.put<import("./types").LLMModel>(`/models/${modelId}`, body),
  remove: (modelId: string) => http.del<void>(`/models/${modelId}`),
  test: (body: import("./types").TestLLMModelInput) =>
    http.post<import("./types").TestLLMModelResponse>("/models/test", body),
}
