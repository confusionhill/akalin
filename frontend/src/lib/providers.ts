export interface ProviderPreset {
  id: string
  label: string
  baseUrl: string
  docsUrl?: string
  models: string[]
  needsKey: boolean
}

export const providerPresets: ProviderPreset[] = [
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    docsUrl: "https://platform.openai.com/docs/models",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "o3-mini"],
    needsKey: true,
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    docsUrl: "https://openrouter.ai/models",
    models: ["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet", "google/gemini-2.0-flash"],
    needsKey: true,
  },
  {
    id: "anthropic",
    label: "Anthropic (OpenAI compat)",
    baseUrl: "https://api.anthropic.com/v1",
    docsUrl: "https://docs.anthropic.com",
    models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
    needsKey: true,
  },
  {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    docsUrl: "https://console.groq.com/docs/models",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    needsKey: true,
  },
  {
    id: "together",
    label: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    docsUrl: "https://docs.together.ai/docs/inference-models",
    models: ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo"],
    needsKey: true,
  },
  {
    id: "mistral",
    label: "Mistral AI",
    baseUrl: "https://api.mistral.ai/v1",
    docsUrl: "https://docs.mistral.ai/getting-started/models/models_overview",
    models: ["mistral-large-latest", "mistral-small-latest", "open-mistral-nemo"],
    needsKey: true,
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    docsUrl: "https://api-docs.deepseek.com/",
    models: ["deepseek-chat", "deepseek-reasoner"],
    needsKey: true,
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    baseUrl: "http://localhost:11434/v1",
    docsUrl: "https://ollama.com/library",
    models: ["llama3.2", "qwen2.5", "gemma2"],
    needsKey: false,
  },
  {
    id: "lmstudio",
    label: "LM Studio (local)",
    baseUrl: "http://localhost:1234/v1",
    docsUrl: "https://lmstudio.ai/docs",
    models: [],
    needsKey: false,
  },
  {
    id: "custom",
    label: "Custom",
    baseUrl: "",
    models: [],
    needsKey: false,
  },
]

export function findPresetByBaseUrl(baseUrl: string): ProviderPreset | undefined {
  return providerPresets.find(
    (p) => p.id !== "custom" && p.baseUrl === baseUrl,
  )
}
