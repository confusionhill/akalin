import { http } from "./client"
import type {
  AuthResponse,
  CreateEvaluationInput,
  CreateEvaluationPromptInput,
  CreateProjectInput,
  CreateProviderInput,
  CreateSystemPromptInput,
  CreateTestCaseInput,
  EvaluationPrompt,
  EvaluationRun,
  Project,
  ProviderConfig,
  RunDetails,
  SystemPrompt,
  TestCase,
} from "./types"

export const authApi = {
  login: (email: string, password: string) =>
    http.post<AuthResponse>("/auth/login", { email, password }),
  register: (tenant_name: string, email: string, password: string) =>
    http.post<AuthResponse>("/auth/register", { tenant_name, email, password }),
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

export const evaluationsApi = {
  list: (projectId: string) =>
    http.get<EvaluationRun[]>(`/projects/${projectId}/evaluations`),
  create: (projectId: string, body: CreateEvaluationInput) =>
    http.post<EvaluationRun>(`/projects/${projectId}/evaluations`, body),
  details: (projectId: string, runId: string) =>
    http.get<RunDetails>(`/projects/${projectId}/evaluations/${runId}`),
  remove: (projectId: string, runId: string) =>
    http.del<void>(`/projects/${projectId}/evaluations/${runId}`),
}
